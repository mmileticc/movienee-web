import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { friendlyError } from '../../core/http/friendly-error';
import { Genre } from '../../core/models/movie';
import { BrowsePrefsService } from '../../core/prefs/browse-prefs.service';
import { LanguageService } from '../../core/prefs/language.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';
import { BrowseFilters } from './browse-filters';
import { BrowseList, BrowseMovie, cinemasSubtitle } from './browse-movie';

type StatusFilter = 'all' | 'now' | 'upcoming';
type CinemaSort = 'rating' | 'title' | 'cinema_count';

/**
 * "In cinemas" - See all (NowInCinemasScreen): the whole scraped programme in one call; every filter
 * (title, genre, chain, now/coming soon) and the sorting are local, without network calls.
 */
@Component({
  selector: 'app-now-in-cinemas',
  imports: [TranslocoPipe, RouterLink, BrowseFilters, BrowseList, ErrorState, EmptyState, Spinner],
  templateUrl: './now-in-cinemas.page.html',
  styleUrl: './browse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NowInCinemasPage {
  private readonly movieApi = inject(MovieApi);
  private readonly language = inject(LanguageService);
  protected readonly prefs = inject(BrowsePrefsService);

  protected readonly programme = rxResource({ stream: () => this.movieApi.nowInCinemas() });
  protected readonly error = computed(() =>
    this.programme.error()
      ? friendlyError(this.programme.error(), 'error_cinemas_unavailable')
      : null,
  );

  protected readonly query = signal('');
  protected readonly selectedGenres = signal<number[]>([]);
  protected readonly chain = signal<string | null>(null);
  protected readonly status = signal<StatusFilter>('all');
  protected readonly sort = signal<CinemaSort>('rating');
  protected readonly statuses: StatusFilter[] = ['all', 'now', 'upcoming'];
  protected readonly sorts: CinemaSort[] = ['rating', 'title', 'cinema_count'];

  private readonly movies = computed(() => this.programme.value() ?? []);

  protected readonly genres = computed(() => {
    const byId = new Map<number, Genre>();
    this.movies().forEach((m) => m.genres?.forEach((g) => byId.set(g.id, g)));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly chains = computed(() =>
    [...new Set(this.movies().flatMap((m) => m.cinemas))].sort((a, b) => a.localeCompare(b)),
  );

  protected readonly filtered = computed<BrowseMovie[]>(() => {
    const q = this.query().trim().toLowerCase();
    const genres = this.selectedGenres();
    const chain = this.chain();
    const status = this.status();
    const list = this.movies()
      .filter((m) => !q || m.title.toLowerCase().includes(q))
      .filter((m) => genres.every((g) => m.genres?.some((genre) => genre.id === g)))
      .filter((m) => !chain || m.cinemas.includes(chain))
      .filter((m) => status === 'all' || (status === 'upcoming') === !!m.is_upcoming);

    const sorted = [...list].sort((a, b) => {
      switch (this.sort()) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'cinema_count':
          return b.cinemas.length - a.cinemas.length;
        default:
          return b.vote_average - a.vote_average;
      }
    });

    return sorted.map((m) => ({
      id: m.id,
      title: m.title,
      posterPath: m.poster_path,
      rating: formatRating(m.vote_average, this.language.language()),
      year: releaseYear(m.release_date),
      genres: (m.genres ?? []).map((g) => g.name),
      overview: m.overview,
      subtitle: cinemasSubtitle(m.cinemas),
    }));
  });

  protected readonly filtersActive = computed(
    () =>
      this.query().trim() !== '' ||
      this.selectedGenres().length > 0 ||
      this.chain() !== null ||
      this.status() !== 'all',
  );

  constructor() {
    inject(PageTitle).set(inject(TranslocoService).translate('home_section_now_in_cinemas'));
  }

  protected clearFilters(): void {
    this.query.set('');
    this.selectedGenres.set([]);
    this.chain.set(null);
    this.status.set('all');
  }

  protected onChainChange(value: string): void {
    this.chain.set(value || null);
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as CinemaSort);
  }
}
