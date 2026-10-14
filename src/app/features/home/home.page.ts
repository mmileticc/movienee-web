import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieSummary } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { InViewportDirective } from '../../shared/ui/in-viewport.directive';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';
import { PosterRow } from '../../shared/ui/poster-row';
import { ErrorState, Spinner } from '../../shared/ui/states';

const NOW_IN_CINEMAS_ROW = 20;

/**
 * Home: the "In cinemas now" row (first 20 of the scraped programme) and popular movies with infinite
 * scrolling. Signed-in rows (suggestions, watchlist, friends) are added with the account features.
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
  protected readonly language = inject(LanguageService);

  /** Optional extra row: if it fails, the row is just hidden. */
  protected readonly nowInCinemas = rxResource({ stream: () => this.movieApi.nowInCinemas() });

  protected readonly popular = signal<MovieSummary[]>([]);
  protected readonly popularLoading = signal(false);
  protected readonly popularError = signal<FriendlyError | null>(null);
  protected readonly hasMorePopular = signal(true);
  private page = 0;

  constructor() {
    inject(PageTitle).set(null);
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
