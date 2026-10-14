import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { MovieApi } from '../../core/api/movie-api';
import { SessionStore } from '../../core/auth/session.store';
import { MovieDetail } from '../../core/models/movie';
import { friendlyError } from '../../core/http/friendly-error';
import { LanguageService } from '../../core/prefs/language.service';
import { formatDistance, formatRating } from '../../core/util/format';
import { GeoPoint, currentPosition } from '../../core/util/geo';
import { releaseYear, tmdbImage, tmdbSrcset } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { LibraryStore, MovieSnapshot } from '../../core/state/library.store';
import { ExpandableText } from '../../shared/ui/expandable-text';
import { ImageViewerService } from '../../shared/ui/image-viewer';
import { PosterRow } from '../../shared/ui/poster-row';
import { RatingStars } from '../../shared/ui/rating-stars';
import { SnackbarService } from '../../shared/ui/snackbar';
import { ShareDialogService } from './share-dialog';
import { ErrorState, Spinner } from '../../shared/ui/states';
import { TrailerPlayer } from '../../shared/ui/trailer-player';
import { CommentsSection } from './comments-section';

/** Cinemas always visible before "Show N more". */
const VISIBLE_CINEMAS = 3;

/**
 * Movie detail: hero with poster and ratings, the user's watchlist / watched / rating actions, genres,
 * overview, trailer, the cinemas showing the movie (sortable by distance), images, cast and public
 * comments. Guests trying a personal action get a "sign in" message instead.
 */
@Component({
  selector: 'app-movie-detail',
  imports: [
    RouterLink,
    TranslocoPipe,
    ExpandableText,
    PosterRow,
    TrailerPlayer,
    ErrorState,
    Spinner,
    CommentsSection,
    RatingStars,
  ],
  templateUrl: './movie-detail.page.html',
  styleUrl: './movie-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieDetailPage {
  private readonly movieApi = inject(MovieApi);
  private readonly transloco = inject(TranslocoService);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly pageTitle = inject(PageTitle);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly shareDialog = inject(ShareDialogService);
  protected readonly language = inject(LanguageService);
  protected readonly session = inject(SessionStore);
  protected readonly library = inject(LibraryStore);

  /** Route parameter (`/movie/:id`). */
  readonly id = input.required<string>();

  private readonly location = signal<GeoPoint | null>(null);
  protected readonly locating = signal(false);
  protected readonly locationDenied = signal(false);
  protected readonly showAllCinemas = signal(false);
  protected readonly shareFeedback = signal<string | null>(null);

  protected readonly movie = rxResource({
    params: () => ({ id: Number(this.id()), location: this.location() }),
    stream: ({ params }) => this.movieApi.detail(params.id, params.location ?? undefined),
  });

  /**
   * The movie to show. Reloading the same movie (e.g. sorted by distance) keeps the previous data on
   * screen instead of flashing a spinner; another movie id starts empty.
   */
  protected readonly current = linkedSignal<
    { value: MovieDetail | undefined; id: number },
    MovieDetail | undefined
  >({
    source: () => ({ value: this.movie.value(), id: Number(this.id()) }),
    computation: (source, previous) =>
      source.value ?? (previous?.value?.id === source.id ? previous.value : undefined),
  });

  protected readonly error = computed(() =>
    this.movie.error() ? friendlyError(this.movie.error(), 'error_load_movie') : null,
  );

  private readonly narrowScreen =
    typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
  /** A CSS background cannot use srcset, so phones get the smaller file up front. */
  protected readonly backdrop = computed(() =>
    tmdbImage(this.current()?.backdrop_path, this.narrowScreen ? 'w780' : 'w1280'),
  );
  protected readonly poster = computed(() => tmdbImage(this.current()?.poster_path, 'w342'));
  protected readonly posterSrcset = computed(() =>
    tmdbSrcset(this.current()?.poster_path, ['w185', 'w342', 'w500']),
  );
  protected readonly year = computed(() => releaseYear(this.current()?.release_date));
  protected readonly rating = computed(() =>
    formatRating(this.current()?.vote_average, this.language.language()),
  );
  protected readonly imdbRating = computed(() =>
    formatRating(this.current()?.imdb_rating, this.language.language()),
  );
  protected readonly cinemas = computed(() => {
    const all = this.current()?.showtimes ?? [];
    return this.showAllCinemas() ? all : all.slice(0, VISIBLE_CINEMAS);
  });
  protected readonly hiddenCinemaCount = computed(
    () => (this.current()?.showtimes.length ?? 0) - VISIBLE_CINEMAS,
  );
  protected readonly stills = computed(() =>
    (this.current()?.backdrops ?? []).map((path) => ({
      src: tmdbImage(path, 'w300') ?? '',
      srcset: tmdbSrcset(path, ['w300', 'w780']),
    })),
  );

  protected readonly inWatchlist = computed(() => {
    const movie = this.current();
    return !!movie && this.library.isInWatchlist(movie.id);
  });
  protected readonly watched = computed(() => {
    const movie = this.current();
    return movie ? this.library.historyItem(movie.id) : undefined;
  });

  /** Friends who watched this movie (signed in only; silently empty when it fails). */
  protected readonly friendsWatched = rxResource({
    params: () => (this.session.isSignedIn() ? Number(this.id()) : null),
    stream: ({ params }) => (params ? this.movieApi.friendsWhoWatched(params) : of([])),
  });

  constructor() {
    effect(() => this.pageTitle.set(this.current()?.title));
    effect(() => {
      if (this.session.isSignedIn()) this.library.ensureLoaded();
    });
  }

  protected async toggleWatchlist(): Promise<void> {
    const movie = this.snapshot();
    if (!movie || this.requireSignIn('movie_detail_watchlist_signin_toast')) return;
    if (!(await this.library.toggleWatchlist(movie))) this.showError('error_server');
  }

  protected async toggleWatched(): Promise<void> {
    const movie = this.snapshot();
    if (!movie || this.requireSignIn('movie_detail_watched_signin_toast')) return;
    if (!(await this.library.toggleWatched(movie))) this.showError('error_server');
  }

  protected async rate(rating: number): Promise<void> {
    const movie = this.snapshot();
    if (!movie || this.requireSignIn('movie_detail_rate_signin_toast')) return;
    if (!(await this.library.setRating(movie, rating))) this.showError('library_rating_failed');
  }

  protected async sendToFriend(): Promise<void> {
    const movie = this.current();
    if (!movie || this.requireSignIn('share_friend_signin_toast')) return;
    if (await this.shareDialog.open(movie.id, movie.title)) {
      this.snackbar.show(this.transloco.translate('share_friend_sent'));
    }
  }

  private snapshot(): MovieSnapshot | null {
    const m = this.current();
    if (!m) return null;
    return {
      id: m.id,
      title: m.title,
      posterPath: m.poster_path,
      genres: m.genres,
      releaseDate: m.release_date,
      voteAverage: m.vote_average,
      runtime: m.runtime,
    };
  }

  /** For guests: shows the message with a "Sign in" action and returns true (the action stops). */
  private requireSignIn(messageKey: string): boolean {
    if (this.session.isSignedIn()) return false;
    this.snackbar.show(this.transloco.translate(messageKey), {
      actionLabel: this.transloco.translate('profile_sign_in'),
      action: () =>
        void this.router.navigate(['/sign-in'], { queryParams: { next: this.router.url } }),
    });
    return true;
  }

  private showError(key: string): void {
    this.snackbar.show(this.transloco.translate(key));
  }

  protected distance(km: number | null | undefined): string | null {
    return km == null ? null : formatDistance(km, this.language.language());
  }

  /** Asks for the location only on this explicit action, then reloads with cinemas sorted by distance. */
  protected async sortByDistance(): Promise<void> {
    this.locating.set(true);
    const position = await currentPosition();
    this.locating.set(false);
    this.locationDenied.set(position === null);
    if (position) this.location.set(position);
  }

  protected openPoster(): void {
    const movie = this.current();
    const src = tmdbImage(movie?.poster_path, 'original');
    if (movie && src) this.imageViewer.open([src], 0, movie.title);
  }

  protected openBackdrop(index: number): void {
    const movie = this.current();
    if (!movie?.backdrops) return;
    const images = movie.backdrops.map((path) => tmdbImage(path, 'original') ?? '');
    this.imageViewer.open(images, index, movie.title);
  }

  protected profileImage(path: string | null | undefined): string | null {
    return tmdbImage(path, 'w185');
  }

  /** Native share sheet where available, otherwise copies the link. Same link as the Android app. */
  protected async share(): Promise<void> {
    const movie = this.current();
    if (!movie) return;
    const url = `${environment.apiBaseUrl}/m/${movie.id}`;
    const text = this.transloco.translate('movie_detail_share_text', { p1: movie.title, p2: url });
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.flashShareFeedback('web_link_copied');
    } catch (error) {
      // AbortError = the user closed the share sheet; nothing to report.
      if ((error as Error)?.name !== 'AbortError') this.flashShareFeedback('web_share_failed');
    }
  }

  private flashShareFeedback(key: string): void {
    this.shareFeedback.set(this.transloco.translate(key));
    setTimeout(() => this.shareFeedback.set(null), 2500);
  }
}
