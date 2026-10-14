import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SocialApi } from '../../core/api/social-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { Genre } from '../../core/models/movie';
import { MovieSuggestion } from '../../core/models/social';
import { LanguageService } from '../../core/prefs/language.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { InViewportDirective } from '../../shared/ui/in-viewport.directive';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';

/**
 * Movie Night (MovieNightScreen): suggestions for watching together with a friend. The header shows
 * the taste match once; shared genres work as a local filter; pages are appended (infinite scroll),
 * so a suggestion the user liked is never lost.
 */
@Component({
  selector: 'app-movie-night',
  imports: [
    TranslocoPipe,
    RouterLink,
    MovieListRow,
    ErrorState,
    EmptyState,
    Spinner,
    InViewportDirective,
  ],
  templateUrl: './movie-night.page.html',
  styleUrl: './movie-night.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieNightPage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly transloco = inject(TranslocoService);
  private readonly pageTitle = inject(PageTitle);
  private readonly language = inject(LanguageService);

  /** Route parameter (`/friends/:friendId/movie-night`). */
  readonly friendId = input.required<string>();

  protected readonly suggestions = signal<MovieSuggestion[]>([]);
  protected readonly friendName = signal<string | null>(null);
  protected readonly matchScore = signal<number | null>(null);
  protected readonly sharedGenres = signal<Genre[]>([]);
  protected readonly selectedGenre = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);
  protected readonly hasMore = signal(true);
  private page = 0;

  protected readonly visible = computed(() => {
    const genre = this.selectedGenre();
    return genre === null
      ? this.suggestions()
      : this.suggestions().filter((s) => s.genre_ids?.includes(genre));
  });

  /** "You / Friend" affinity for the main shared genre - the same for every suggestion. */
  protected readonly topScores = computed(() => this.suggestions()[0]?.scores ?? null);

  ngOnInit(): void {
    this.pageTitle.set(this.transloco.translate('movie_night_top_bar_title'));
    this.loadMore();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loading.set(true);
    this.error.set(null);
    const nextPage = this.page + 1;
    this.api.movieNight(this.friendId(), nextPage).subscribe({
      next: (response) => {
        const known = new Set(this.suggestions().map((s) => s.tmdb_id));
        this.suggestions.update((list) => [
          ...list,
          ...response.suggestions.filter((s) => !known.has(s.tmdb_id)),
        ]);
        this.friendName.set(response.friend_username ?? this.friendName());
        this.matchScore.set(response.match_score ?? this.matchScore());
        if (response.shared_genres?.length) this.sharedGenres.set(response.shared_genres);
        this.page = nextPage;
        this.hasMore.set(response.has_more && response.suggestions.length > 0);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'movie_night_error_generic'));
        this.loading.set(false);
      },
    });
  }

  protected toggleGenre(id: number): void {
    this.selectedGenre.set(this.selectedGenre() === id ? null : id);
  }

  protected meta(suggestion: MovieSuggestion): string {
    const rating = formatRating(suggestion.vote_average, this.language.language());
    return [releaseYear(suggestion.release_date), rating && `★ ${rating}`]
      .filter(Boolean)
      .join(' · ');
  }

  /** Match scores come from the backend as 0-100. */
  protected percent(value: number): number {
    return Math.round(Math.min(100, Math.max(0, value)));
  }
}
