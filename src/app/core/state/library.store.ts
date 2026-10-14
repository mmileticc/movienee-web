import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, forkJoin, map } from 'rxjs';
import { UserApi } from '../api/user-api';
import { SessionStore } from '../auth/session.store';
import { FriendlyError, friendlyError } from '../http/friendly-error';
import { Genre } from '../models/movie';
import { HistoryItem, WatchlistItem } from '../models/user';

/** What the store needs to know about a movie to show it in the library before the server answers. */
export interface MovieSnapshot {
  id: number;
  title: string;
  posterPath?: string | null;
  genres?: Genre[] | null;
  releaseDate?: string | null;
  voteAverage?: number | null;
  runtime?: number | null;
}

/**
 * Keeps one movie's server state in line with what the user last asked for.
 *
 * Every user action only records the *desired* state; a per-movie worker then sends requests one at
 * a time until the server-confirmed state matches it. Requests for the same movie are never sent in
 * parallel and never cancelled mid-flight (a cancelled request may still reach the server), and
 * rapid taps collapse into as few requests as needed. On failure only that movie goes back to its
 * confirmed state; other movies are untouched.
 */
class PerMovieSync<V> {
  private readonly desired = new Map<number, V | null>();
  private readonly running = new Set<number>();
  private readonly waiters = new Map<number, ((ok: boolean) => void)[]>();
  private epoch = 0;

  constructor(
    /** Server-confirmed state per movie (absent = not on the server). */
    readonly confirmed: Map<number, V>,
    private readonly sameState: (a: V | null, b: V | null) => boolean,
    private readonly send: (id: number, want: V | null, have: V | null) => Observable<V | null>,
    private readonly onConfirmed: (id: number, value: V | null) => void,
    private readonly onFailed: (id: number, confirmed: V | null) => void,
  ) {}

  /** Records the desired state; resolves to false if the server refused (the movie was reverted). */
  request(id: number, value: V | null): Promise<boolean> {
    this.desired.set(id, value);
    const done = new Promise<boolean>((resolve) =>
      this.waiters.set(id, [...(this.waiters.get(id) ?? []), resolve]),
    );
    void this.run(id);
    return done;
  }

  /** Forgets everything (account change); in-flight results of the old account are ignored. */
  reset(): void {
    this.epoch++;
    this.desired.clear();
    this.running.clear();
    this.confirmed.clear();
    this.waiters.forEach((list) => list.forEach((resolve) => resolve(true)));
    this.waiters.clear();
  }

  private async run(id: number): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    const epoch = this.epoch;
    let ok = true;
    // A bounded loop: each pass handles a change the user made while the previous request ran.
    for (let pass = 0; pass < 5; pass++) {
      const want = this.desired.has(id) ? (this.desired.get(id) ?? null) : null;
      const have = this.confirmed.get(id) ?? null;
      if (this.sameState(want, have)) break;
      try {
        const result = await firstValueFrom(this.send(id, want, have));
        if (epoch !== this.epoch) return;
        if (result === null) this.confirmed.delete(id);
        else this.confirmed.set(id, result);
        this.onConfirmed(id, result);
        // The server is authoritative for what it accepted; stop unless the user changed it again.
        if (this.desired.get(id) === want) {
          this.desired.set(id, result);
          break;
        }
      } catch {
        if (epoch !== this.epoch) return;
        this.desired.set(id, have);
        this.onFailed(id, have);
        ok = false;
        break;
      }
    }
    this.running.delete(id);
    this.waiters.get(id)?.forEach((resolve) => resolve(ok));
    this.waiters.delete(id);
  }
}

/**
 * The signed-in user's watchlist and watched history, shared by the movie page, the Library and Home
 * (the web counterpart of the Android Room cache). Loaded once per account; every change shows
 * immediately (optimistic) and is synchronized per movie by PerMovieSync.
 */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly api = inject(UserApi);
  private readonly session = inject(SessionStore);

  readonly watchlist = signal<WatchlistItem[] | null>(null);
  readonly history = signal<HistoryItem[] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<FriendlyError | null>(null);

  private readonly watchlistIds = computed(
    () => new Set((this.watchlist() ?? []).map((i) => i.tmdb_id)),
  );
  private readonly historyById = computed(
    () => new Map((this.history() ?? []).map((i) => [i.tmdb_id, i])),
  );

  /** The account the loaded data belongs to; a different signed-in user resets the store. */
  private owner: string | null = null;
  private loadToken = 0;

  private readonly watchlistSync = new PerMovieSync<WatchlistItem>(
    new Map(),
    (a, b) => (a === null) === (b === null),
    (id, want) =>
      want ? this.api.addToWatchlist(id) : this.api.removeFromWatchlist(id).pipe(map(() => null)),
    (id, saved) => {
      // Only refresh a row that is still on screen - the user may have removed it meanwhile.
      if (saved)
        this.watchlist.update((list) => (list ?? []).map((i) => (i.tmdb_id === id ? saved : i)));
    },
    (id, confirmed) =>
      this.watchlist.update((list) =>
        confirmed ? upsert(list, confirmed) : (list ?? []).filter((i) => i.tmdb_id !== id),
      ),
  );

  private readonly historySync = new PerMovieSync<HistoryItem>(
    new Map(),
    (a, b) => (a === null || b === null ? a === b : a.user_rating === b.user_rating),
    (id, want, have) => {
      if (!want) return this.api.removeFromHistory(id).pipe(map(() => null));
      // rating null = "watched without a rating" (0 would be rounded up to 1 by the backend).
      const rating = want.user_rating || null;
      return have
        ? this.api.updateHistory(id, { rating })
        : this.api.addToHistory({ tmdbId: id, rating, duration: want.duration || null });
    },
    (id, saved) => {
      if (!saved) return;
      // Keep the rating currently on screen (the user may already have changed it again).
      this.history.update((list) =>
        (list ?? []).map((i) => (i.tmdb_id === id ? { ...saved, user_rating: i.user_rating } : i)),
      );
    },
    (id, confirmed) =>
      this.history.update((list) =>
        confirmed ? upsert(list, confirmed) : (list ?? []).filter((i) => i.tmdb_id !== id),
      ),
  );

  constructor() {
    // Sign-out or another account: never show the previous user's library.
    effect(() => {
      const userId = this.session.userId();
      if (userId !== this.owner) this.reset(userId);
    });
  }

  /** Loads the library if it is not loaded yet (no-op when signed out). */
  ensureLoaded(): void {
    const userId = this.session.userId();
    if (userId !== this.owner) this.reset(userId);
    if (userId && this.watchlist() === null && !this.loading()) this.reload();
  }

  reload(): void {
    const userId = this.session.userId();
    if (!userId) return;
    const token = ++this.loadToken;
    this.loading.set(true);
    this.error.set(null);
    forkJoin([this.api.watchlist(), this.api.history()]).subscribe({
      next: ([watchlist, history]) => {
        if (token !== this.loadToken) return;
        this.watchlist.set(watchlist);
        this.history.set(history);
        replaceAll(this.watchlistSync.confirmed, watchlist);
        replaceAll(this.historySync.confirmed, history);
        this.loading.set(false);
      },
      error: (e) => {
        if (token !== this.loadToken) return;
        this.error.set(friendlyError(e, 'error_library_refresh'));
        this.loading.set(false);
      },
    });
  }

  isInWatchlist(tmdbId: number): boolean {
    return this.watchlistIds().has(tmdbId);
  }

  historyItem(tmdbId: number): HistoryItem | undefined {
    return this.historyById().get(tmdbId);
  }

  /** Adds or removes the movie; resolves to false when the server refused (the movie was reverted). */
  toggleWatchlist(movie: MovieSnapshot): Promise<boolean> {
    if (this.isInWatchlist(movie.id)) return this.removeFromWatchlist(movie.id);
    const item: WatchlistItem = {
      tmdb_id: movie.id,
      title: movie.title,
      poster_path: movie.posterPath,
      added_at: Date.now(),
      priority: 0,
      genres: movie.genres,
      release_year: yearOf(movie.releaseDate),
      vote_average: movie.voteAverage,
    };
    this.watchlist.update((list) => [item, ...(list ?? [])]);
    return this.watchlistSync.request(movie.id, item);
  }

  removeFromWatchlist(tmdbId: number): Promise<boolean> {
    this.watchlist.update((list) => (list ?? []).filter((i) => i.tmdb_id !== tmdbId));
    return this.watchlistSync.request(tmdbId, null);
  }

  /** Marks as watched (without a rating) or, when already watched, undoes it (also removes the rating). */
  toggleWatched(movie: MovieSnapshot): Promise<boolean> {
    return this.historyItem(movie.id) ? this.removeFromHistory(movie.id) : this.setRating(movie, 0);
  }

  /** Sets the rating (1-10) and marks the movie as watched; 0 = watched without a rating (new only). */
  setRating(movie: MovieSnapshot, rating: number): Promise<boolean> {
    const existing = this.historyItem(movie.id);
    // On a watched movie, 0 would mean "keep the rating" to the backend - nothing to change.
    if (existing && rating === 0) return Promise.resolve(true);
    const item: HistoryItem = existing
      ? { ...existing, user_rating: rating }
      : {
          tmdb_id: movie.id,
          title: movie.title,
          poster_path: movie.posterPath,
          user_rating: rating,
          watched_at: Date.now(),
          duration: movie.runtime ?? 0,
          genres: movie.genres,
          release_year: yearOf(movie.releaseDate),
          vote_average: movie.voteAverage,
        };
    this.history.update((list) => upsert(list, item));
    return this.historySync.request(movie.id, item);
  }

  removeFromHistory(tmdbId: number): Promise<boolean> {
    this.history.update((list) => (list ?? []).filter((i) => i.tmdb_id !== tmdbId));
    return this.historySync.request(tmdbId, null);
  }

  private reset(userId: string | null): void {
    this.owner = userId;
    this.loadToken++;
    this.watchlistSync.reset();
    this.historySync.reset();
    this.watchlist.set(null);
    this.history.set(null);
    this.error.set(null);
    this.loading.set(false);
  }
}

function yearOf(date: string | null | undefined): number | null {
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(year) ? year : null;
}

/** Replaces the item with the same tmdb_id, or adds it at the top. */
function upsert<T extends { tmdb_id: number }>(list: T[] | null, item: T): T[] {
  const current = list ?? [];
  return current.some((i) => i.tmdb_id === item.tmdb_id)
    ? current.map((i) => (i.tmdb_id === item.tmdb_id ? item : i))
    : [item, ...current];
}

function replaceAll<T extends { tmdb_id: number }>(target: Map<number, T>, items: T[]): void {
  target.clear();
  items.forEach((item) => target.set(item.tmdb_id, item));
}
