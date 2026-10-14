import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieSummary } from '../../core/models/movie';
import { BrowsePrefsService } from '../../core/prefs/browse-prefs.service';
import { LanguageService } from '../../core/prefs/language.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { InViewportDirective } from '../../shared/ui/in-viewport.directive';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';
import { BrowseFilters } from './browse-filters';
import { BrowseList, BrowseMovie } from './browse-movie';

/**
 * "Suggested for you" - See all (SuggestedMoviesScreen): the same list as the Home row
 * (`/featured`, personalized for a signed-in user) with infinite scrolling and local filters
 * (title, genre) over all loaded pages.
 */
@Component({
  selector: 'app-suggested',
  imports: [
    TranslocoPipe,
    RouterLink,
    BrowseFilters,
    BrowseList,
    ErrorState,
    EmptyState,
    Spinner,
    InViewportDirective,
  ],
  templateUrl: './suggested.page.html',
  styleUrl: './browse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestedPage implements OnInit {
  private readonly movieApi = inject(MovieApi);
  private readonly language = inject(LanguageService);
  protected readonly prefs = inject(BrowsePrefsService);

  private readonly allGenres = toSignal(this.movieApi.genres(), { initialValue: [] });
  protected readonly movies = signal<MovieSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);
  protected readonly query = signal('');
  protected readonly selectedGenres = signal<number[]>([]);
  protected readonly hasMore = signal(true);
  private page = 0;

  /** Only genres present among the loaded movies (an empty filter makes no sense). */
  protected readonly genres = computed(() => {
    const present = new Set(this.movies().flatMap((m) => m.genre_ids ?? []));
    return this.allGenres().filter((g) => present.has(g.id));
  });

  protected readonly filtered = computed<BrowseMovie[]>(() => {
    const q = this.query().trim().toLowerCase();
    const genres = this.selectedGenres();
    const names = new Map(this.allGenres().map((g) => [g.id, g.name]));
    return this.movies()
      .filter((m) => !q || m.title.toLowerCase().includes(q))
      .filter((m) => genres.every((g) => m.genre_ids?.includes(g)))
      .map((m) => ({
        id: m.id,
        title: m.title,
        posterPath: m.poster_path,
        rating: formatRating(m.vote_average, this.language.language()),
        year: releaseYear(m.release_date),
        genres: (m.genre_ids ?? []).map((id) => names.get(id)).filter((n): n is string => !!n),
        overview: m.overview,
        subtitle: null,
      }));
  });

  protected readonly filtersActive = computed(
    () => this.query().trim() !== '' || this.selectedGenres().length > 0,
  );

  constructor() {
    inject(PageTitle).set(inject(TranslocoService).translate('home_section_personalized'));
  }

  ngOnInit(): void {
    this.loadMore();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loading.set(true);
    this.error.set(null);
    const nextPage = this.page + 1;
    this.movieApi.featured(nextPage).subscribe({
      next: (movies) => {
        const known = new Set(this.movies().map((m) => m.id));
        this.movies.update((list) => [...list, ...movies.filter((m) => !known.has(m.id))]);
        this.page = nextPage;
        this.hasMore.set(movies.length > 0);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'error_suggestions_unavailable'));
        this.loading.set(false);
      },
    });
  }

  protected clearFilters(): void {
    this.query.set('');
    this.selectedGenres.set([]);
  }
}
