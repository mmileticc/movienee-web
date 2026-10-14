import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { MovieApi } from '../../core/api/movie-api';
import { SocialApi } from '../../core/api/social-api';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieSummary } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { LibraryStore } from '../../core/state/library.store';
import { FriendActivity } from '../../core/models/social';
import { InViewportDirective } from '../../shared/ui/in-viewport.directive';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';
import { PosterRow } from '../../shared/ui/poster-row';
import { ErrorState, Spinner } from '../../shared/ui/states';

const NOW_IN_CINEMAS_ROW = 20;

/**
 * Home: for a signed-in user "Suggested for you", "Saved to watch" and "Friends are watching"; for
 * everyone the "In cinemas now" row (first 20 of the scraped programme) and popular movies with
 * infinite scrolling. The extra rows are optional: when one fails it is simply hidden.
 */
@Component({
  selector: 'app-home',
  imports: [TranslocoPipe, PosterRow, MoviePosterCard, ErrorState, Spinner, InViewportDirective],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly movieApi = inject(MovieApi);
  private readonly socialApi = inject(SocialApi);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageService);
  protected readonly session = inject(SessionStore);
  protected readonly library = inject(LibraryStore);

  /** Personalized by the user's genre taste; only for a signed-in user. */
  protected readonly suggested = rxResource({
    params: () => this.session.userId(),
    stream: ({ params }) => (params ? this.movieApi.featured(1) : of([])),
  });

  /** Latest movies friends watched or rated - one card per movie (its latest activity). */
  protected readonly friendsActivity = rxResource({
    params: () => this.session.userId(),
    stream: ({ params }) => (params ? this.socialApi.activity() : of([])),
  });
  protected readonly friendsRow = computed(() => {
    const seen = new Set<number>();
    return (this.friendsActivity.value() ?? [])
      .filter((a) => a.action !== 'added_to_watchlist')
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter((a) => !seen.has(a.tmdb_id) && seen.add(a.tmdb_id));
  });
  protected readonly watchlistRow = computed(() => (this.library.watchlist() ?? []).slice(0, 20));

  /** Optional extra row: if it fails, the row is just hidden. */
  protected readonly nowInCinemas = rxResource({ stream: () => this.movieApi.nowInCinemas() });

  protected readonly popular = signal<MovieSummary[]>([]);
  protected readonly popularLoading = signal(false);
  protected readonly popularError = signal<FriendlyError | null>(null);
  protected readonly hasMorePopular = signal(true);
  private page = 0;

  constructor() {
    inject(PageTitle).set(null);
    effect(() => {
      if (this.session.isSignedIn()) this.library.ensureLoaded();
    });
  }

  protected activityCaption(activity: FriendActivity): string {
    const rating = activity.metadata.rating;
    return activity.action === 'rated' && rating
      ? this.transloco.translate('profile_activity_row_rated', {
          p1: activity.friend_name,
          p2: rating,
        })
      : this.transloco.translate('profile_activity_row_watched', { p1: activity.friend_name });
  }

  ngOnInit(): void {
    this.loadMorePopular();
  }

  protected cinemaRow() {
    return (this.nowInCinemas.value() ?? []).slice(0, NOW_IN_CINEMAS_ROW);
  }

  protected loadMorePopular(): void {
    if (this.popularLoading() || !this.hasMorePopular()) return;
    this.popularLoading.set(true);
    this.popularError.set(null);
    const nextPage = this.page + 1;
    this.movieApi.trending(nextPage).subscribe({
      next: (movies) => {
        // Pages can overlap when the popularity order changes between calls - dedupe by id.
        const known = new Set(this.popular().map((m) => m.id));
        this.popular.update((list) => [...list, ...movies.filter((m) => !known.has(m.id))]);
        this.page = nextPage;
        this.hasMorePopular.set(movies.length > 0);
        this.popularLoading.set(false);
      },
      error: (error) => {
        this.popularError.set(friendlyError(error, 'error_server'));
        this.popularLoading.set(false);
      },
    });
  }

  protected rating(value: number): string | null {
    return formatRating(value, this.language.language());
  }

  protected year(date: string | null | undefined): string | null {
    return releaseYear(date);
  }
}
