import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Genre } from '../../core/models/movie';
import { HistoryItem, WatchlistItem } from '../../core/models/user';
import { LanguageService } from '../../core/prefs/language.service';
import { LibraryStore } from '../../core/state/library.store';
import { formatRating } from '../../core/util/format';
import { PageTitle } from '../../core/util/page-title';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { RatingStars } from '../../shared/ui/rating-stars';
import { SnackbarService } from '../../shared/ui/snackbar';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';

type LibraryTab = 'watchlist' | 'watched';
type WatchlistSort = 'added' | 'tmdb_rating' | 'title' | 'year';
type HistorySort = 'watched' | 'my_rating' | 'tmdb_rating' | 'title';

/**
 * Library (LibraryScreen): the watchlist and the watched movies, with a shared title/genre filter,
 * sorting per tab, "my rating N+" on Watched, a quick rating edit and removal with "Undo" (the server
 * call is made only when the snackbar expires, so Undo never has to restore anything there).
 */
@Component({
  selector: 'app-library',
  imports: [TranslocoPipe, RouterLink, MovieListRow, RatingStars, EmptyState, ErrorState, Spinner],
  templateUrl: './library.page.html',
  styleUrl: './library.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPage {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly snackbar = inject(SnackbarService);
  private readonly language = inject(LanguageService);
  protected readonly library = inject(LibraryStore);

  /** Query parameter `?tab=watched`. */
  readonly tab = input<string | undefined>();
  protected readonly activeTab = computed<LibraryTab>(() =>
    this.tab() === 'watched' ? 'watched' : 'watchlist',
  );

  protected readonly query = signal('');
  protected readonly selectedGenres = signal<number[]>([]);
  protected readonly watchlistSort = signal<WatchlistSort>('added');
  protected readonly historySort = signal<HistorySort>('watched');
  protected readonly minRating = signal<number | null>(null);
  protected readonly editingRating = signal<number | null>(null);
  /** Removed items waiting for the "Undo" snackbar to expire - hidden from the lists meanwhile. */
  private readonly pendingRemoval = signal<Set<number>>(new Set());

  protected readonly watchlistSorts: WatchlistSort[] = ['added', 'tmdb_rating', 'title', 'year'];
  protected readonly historySorts: HistorySort[] = ['watched', 'my_rating', 'tmdb_rating', 'title'];
  protected readonly ratingThresholds = [7, 8, 9];

  protected readonly genres = computed(() => {
    const items: { genres?: Genre[] | null }[] =
      this.activeTab() === 'watchlist'
        ? (this.library.watchlist() ?? [])
        : (this.library.history() ?? []);
    const byId = new Map<number, Genre>();
    items.forEach((i) => i.genres?.forEach((g) => byId.set(g.id, g)));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly watchlistItems = computed(() => {
    const items = this.applyCommonFilters(this.library.watchlist() ?? []);
    const sort = this.watchlistSort();
    return [...items].sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'tmdb_rating':
          return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        case 'year':
          return (b.release_year ?? 0) - (a.release_year ?? 0);
        default:
          return b.added_at - a.added_at;
      }
    });
  });

  protected readonly historyItems = computed(() => {
    const min = this.minRating();
    const items = this.applyCommonFilters(this.library.history() ?? []).filter(
      (i) => min === null || i.user_rating >= min,
    );
    const sort = this.historySort();
    return [...items].sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'tmdb_rating':
          return (b.vote_average ?? 0) - (a.vote_average ?? 0);
        case 'my_rating':
          return b.user_rating - a.user_rating;
        default:
          return b.watched_at - a.watched_at;
      }
    });
  });

  /** Totals before filtering - distinguishes "empty list" from "the filter matches nothing". */
  protected readonly watchlistTotal = computed(() => this.library.watchlist()?.length ?? 0);
  protected readonly historyTotal = computed(() => this.library.history()?.length ?? 0);

  constructor() {
    inject(PageTitle).set(this.transloco.translate('library_top_bar_title'));
    this.library.ensureLoaded();
  }

  protected selectTab(tab: LibraryTab): void {
    this.editingRating.set(null);
    void this.router.navigate([], { queryParams: { tab: tab === 'watched' ? 'watched' : null } });
  }

  protected toggleGenre(id: number): void {
    const selected = this.selectedGenres();
    this.selectedGenres.set(
      selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id],
    );
  }

  /** Tapping the same threshold again turns it off. */
  protected toggleMinRating(value: number): void {
    this.minRating.set(this.minRating() === value ? null : value);
  }

  protected setWatchlistSort(value: string): void {
    this.watchlistSort.set(value as WatchlistSort);
  }

  protected setHistorySort(value: string): void {
    this.historySort.set(value as HistorySort);
  }

  protected watchlistMeta(item: WatchlistItem): string {
    return this.meta(item.release_year, item.vote_average, item.genres);
  }

  protected historyMeta(item: HistoryItem): string {
    const mine = item.user_rating
      ? this.transloco.translate('library_my_rating', { p1: item.user_rating })
      : this.transloco.translate('library_not_rated');
    return [mine, this.meta(item.release_year, item.vote_average, item.genres)]
      .filter(Boolean)
      .join(' · ');
  }

  protected async rate(item: HistoryItem, rating: number): Promise<void> {
    const ok = await this.library.setRating({ id: item.tmdb_id, title: item.title }, rating);
    this.snackbar.show(
      this.transloco.translate(ok ? 'library_rating_saved' : 'library_rating_failed'),
    );
    if (ok) this.editingRating.set(null);
  }

  protected removeFromWatchlist(item: WatchlistItem): void {
    this.removeWithUndo(item.tmdb_id, 'library_removed_snackbar', item.title, () =>
      this.library.removeFromWatchlist(item.tmdb_id),
    );
  }

  protected removeFromHistory(item: HistoryItem): void {
    this.removeWithUndo(item.tmdb_id, 'library_removed_from_history_snackbar', item.title, () =>
      this.library.removeFromHistory(item.tmdb_id),
    );
  }

  private removeWithUndo(
    tmdbId: number,
    messageKey: string,
    title: string,
    commit: () => Promise<boolean>,
  ): void {
    const pending = (update: (set: Set<number>) => void) =>
      this.pendingRemoval.update((current) => {
        const next = new Set(current);
        update(next);
        return next;
      });
    pending((set) => set.add(tmdbId));
    this.snackbar.show(this.transloco.translate(messageKey, { p1: title }), {
      actionLabel: this.transloco.translate('library_undo'),
      action: () => pending((set) => set.delete(tmdbId)),
      onDismiss: () => {
        void commit().then((ok) => {
          pending((set) => set.delete(tmdbId));
          if (!ok) this.snackbar.show(this.transloco.translate('library_remove_failed'));
        });
      },
    });
  }

  private applyCommonFilters<T extends { tmdb_id: number; title: string; genres?: Genre[] | null }>(
    items: T[],
  ): T[] {
    const q = this.query().trim().toLowerCase();
    const genres = this.selectedGenres();
    const hidden = this.pendingRemoval();
    return items
      .filter((i) => !hidden.has(i.tmdb_id))
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .filter((i) => genres.every((g) => i.genres?.some((genre) => genre.id === g)));
  }

  /** "2024 · TMDB 7.8 · Comedy, Drama" - missing parts are skipped. */
  private meta(
    year: number | null | undefined,
    rating: number | null | undefined,
    genres?: Genre[] | null,
  ) {
    const tmdb = formatRating(rating, this.language.language());
    return [
      year ? String(year) : null,
      tmdb ? this.transloco.translate('library_tmdb_rating', { p1: tmdb }) : null,
      (genres ?? [])
        .slice(0, 2)
        .map((g) => g.name)
        .join(', ') || null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
