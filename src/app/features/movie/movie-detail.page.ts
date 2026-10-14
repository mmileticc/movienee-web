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
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { MovieApi } from '../../core/api/movie-api';
import { MovieDetail } from '../../core/models/movie';
import { friendlyError } from '../../core/http/friendly-error';
import { LanguageService } from '../../core/prefs/language.service';
import { formatDistance, formatRating } from '../../core/util/format';
import { GeoPoint, currentPosition } from '../../core/util/geo';
import { releaseYear, tmdbImage } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { ExpandableText } from '../../shared/ui/expandable-text';
import { ImageViewerService } from '../../shared/ui/image-viewer';
import { PosterRow } from '../../shared/ui/poster-row';
import { ErrorState, Spinner } from '../../shared/ui/states';
import { TrailerPlayer } from '../../shared/ui/trailer-player';
import { CommentsSection } from './comments-section';

/** Cinemas always visible before "Show N more". */
const VISIBLE_CINEMAS = 3;

/**
 * Movie detail: hero with poster and ratings, genres, overview, trailer, the cinemas showing the movie
 * (sortable by distance), images, cast and public comments. Personal actions (watchlist, watched,
 * rating) arrive with the account features.
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
  protected readonly language = inject(LanguageService);

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

  protected readonly backdrop = computed(() => tmdbImage(this.current()?.backdrop_path, 'w1280'));
  protected readonly poster = computed(() => tmdbImage(this.current()?.poster_path, 'w500'));
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
  protected readonly backdrops = computed(() =>
    (this.current()?.backdrops ?? []).map((path) => tmdbImage(path, 'w780') ?? ''),
  );

  constructor() {
    effect(() => this.pageTitle.set(this.current()?.title));
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
