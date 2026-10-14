import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { MovieApi } from '../../core/api/movie-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieSummary, NowInCinemasMovie } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { RecentSearchesService } from '../../core/prefs/recent-searches.service';
import { formatRating } from '../../core/util/format';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';

type SearchMode = 'all' | 'cinemas';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Search (SearchScreen/SearchViewModel):
 * - "All movies": search-as-you-type over the TMDB catalog (300 ms debounce, 2+ characters);
 *   recent searches are shown before the first search and recorded when a result is opened.
 * - "In cinemas": typing filters the current programme by title locally (free, no network);
 *   Enter runs the semantic (AI) search by description or mood.
 * The query and mode live in the URL (`?q=&mode=cinemas`), so searches can be shared and restored.
 */
@Component({
  selector: 'app-search',
  imports: [TranslocoPipe, MoviePosterCard, MovieListRow, ErrorState, EmptyState, Spinner],
  templateUrl: './search.page.html',
  styleUrl: './search.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage implements OnInit {
  private readonly movieApi = inject(MovieApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  protected readonly recent = inject(RecentSearchesService);
  protected readonly language = inject(LanguageService);

  protected readonly mode = signal<SearchMode>('all');
  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);

  /** Text search results; null = no search has run for the current query yet. */
  protected readonly results = signal<MovieSummary[] | null>(null);

  // "In cinemas" mode.
  protected readonly programme = signal<NowInCinemasMovie[] | null>(null);
  protected readonly programmeError = signal<FriendlyError | null>(null);
  /** Results of the last semantic search; null = show the local title filter instead. */
  protected readonly semanticResults = signal<NowInCinemasMovie[] | null>(null);

  protected readonly filteredProgramme = computed(() => {
    const all = this.programme() ?? [];
    const q = this.query().trim().toLowerCase();
    return q.length < MIN_QUERY_LENGTH ? all : all.filter((m) => m.title.toLowerCase().includes(q));
  });
  protected readonly cinemaList = computed(
    () => this.semanticResults() ?? this.filteredProgramme(),
  );

  private readonly typed$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor() {
    inject(PageTitle).set(this.transloco.translate('search_top_bar_title'));
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.mode.set(params.get('mode') === 'cinemas' ? 'cinemas' : 'all');
    const initial = params.get('q') ?? '';
    this.query.set(initial);
    if (this.mode() === 'cinemas') this.loadProgramme();
    if (initial.trim().length >= MIN_QUERY_LENGTH && this.mode() === 'all')
      this.runTextSearch(initial);

    this.typed$
      .pipe(debounceTime(DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.syncUrl();
        if (this.mode() === 'all') this.runTextSearch(q);
      });
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.semanticResults.set(null);
    this.typed$.next(value);
  }

  /** Enter: immediate text search, or the semantic search in the cinema mode. */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    const q = this.query().trim();
    if (!q) return;
    if (this.mode() === 'all') {
      this.runTextSearch(q);
      this.recent.add(q);
    } else {
      this.runSemanticSearch(q);
    }
    this.syncUrl();
  }

  protected setMode(mode: SearchMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.error.set(null);
    this.semanticResults.set(null);
    if (mode === 'cinemas') this.loadProgramme();
    else this.runTextSearch(this.query());
    this.syncUrl();
  }

  protected clear(): void {
    this.onInput('');
  }

  protected useRecent(q: string): void {
    this.query.set(q);
    this.runTextSearch(q);
    this.recent.add(q);
    this.syncUrl();
  }

  /** The search "worked" when the user opens a result - only then is it remembered. */
  protected onResultOpened(): void {
    if (this.mode() === 'all') this.recent.add(this.query());
  }

  protected retry(): void {
    if (this.mode() === 'all') this.runTextSearch(this.query());
    else if (this.programmeError()) this.loadProgramme();
    else this.runSemanticSearch(this.query());
  }

  protected rating(value: number | null | undefined): string | null {
    return formatRating(value, this.language.language());
  }

  protected year(date: string | null | undefined): string | null {
    return releaseYear(date);
  }

  protected cinemaMeta(movie: NowInCinemasMovie): string {
    return [
      this.rating(movie.vote_average) && `★ ${this.rating(movie.vote_average)}`,
      movie.cinemas.join(', '),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private runTextSearch(q: string): void {
    this.searchSub?.unsubscribe();
    this.error.set(null);
    if (q.trim().length < MIN_QUERY_LENGTH) {
      this.results.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    // Unsubscribing cancels the previous request, so a slow older answer never overwrites a newer one.
    this.searchSub = this.movieApi.search(q.trim()).subscribe({
      next: (movies) => {
        this.results.set(movies);
        this.searching.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'error_search'));
        this.searching.set(false);
      },
    });
  }

  private runSemanticSearch(q: string): void {
    this.searchSub?.unsubscribe();
    this.error.set(null);
    this.searching.set(true);
    this.searchSub = this.movieApi.semanticSearchInCinemas(q).subscribe({
      next: (movies) => {
        this.semanticResults.set(movies);
        this.searching.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'error_search'));
        this.searching.set(false);
      },
    });
  }

  /** The programme is loaded once per visit; the title filter then works without the network. */
  private loadProgramme(): void {
    if (this.programme()) return;
    this.programmeError.set(null);
    this.movieApi.nowInCinemas().subscribe({
      next: (movies) => this.programme.set(movies),
      error: (e) => this.programmeError.set(friendlyError(e, 'error_cinemas_unavailable')),
    });
  }

  private syncUrl(): void {
    const q = this.query().trim();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null, mode: this.mode() === 'cinemas' ? 'cinemas' : null },
      replaceUrl: true,
    });
  }
}
