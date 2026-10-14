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
import { VisionApi } from '../../core/api/vision-api';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { MovieSummary, NowInCinemasMovie } from '../../core/models/movie';
import { VisionSearchResponse } from '../../core/models/vision';
import { LanguageService } from '../../core/prefs/language.service';
import { RecentSearchesService } from '../../core/prefs/recent-searches.service';
import { formatRating } from '../../core/util/format';
import { compressImage } from '../../core/util/image-compress';
import { releaseYear } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';
import { SnackbarService } from '../../shared/ui/snackbar';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';
import { VisionResults } from './vision-results';

type SearchMode = 'all' | 'cinemas';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
/** The backend accepts up to 8 MB; like the Android app, aim for 3 MB and 1600 px. */
const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const UPLOAD_MAX_DIMENSION = 1600;
/** Larger files are refused before decoding, so a huge file cannot freeze the tab. */
const PICKED_MAX_BYTES = 40 * 1024 * 1024;

/**
 * Search (SearchScreen/SearchViewModel):
 * - "All movies": search-as-you-type over the TMDB catalog (300 ms debounce, 2+ characters);
 *   recent searches are shown before the first search and recorded when a result is opened.
 * - "In cinemas": typing filters the current programme by title locally (free, no network);
 *   Enter runs the semantic (AI) search by description or mood.
 * - Image search ("All movies", signed-in users): a photo of a poster or a film still is shrunk in
 *   the browser and recognized by the backend (Gemini vision).
 * The query and mode live in the URL (`?q=&mode=cinemas`), so searches can be shared and restored.
 */
@Component({
  selector: 'app-search',
  imports: [
    TranslocoPipe,
    MoviePosterCard,
    MovieListRow,
    ErrorState,
    EmptyState,
    Spinner,
    VisionResults,
  ],
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
  private readonly visionApi = inject(VisionApi);
  private readonly session = inject(SessionStore);
  private readonly snackbar = inject(SnackbarService);
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

  // Image search.
  /** Object URL of the picked image (shown as a preview). */
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly analyzing = signal(false);
  protected readonly visionResult = signal<VisionSearchResponse | null>(null);
  protected readonly visionError = signal<FriendlyError | null>(null);
  protected readonly imageActive = computed(
    () => !!this.imagePreview() || !!this.visionResult() || !!this.visionError(),
  );
  private pickedImage: File | null = null;
  /** Bumped on every new image or clear, so a late result of an older one is ignored. */
  private imageRun = 0;
  private visionSub?: Subscription;

  private readonly typed$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor() {
    inject(PageTitle).set(this.transloco.translate('search_top_bar_title'));
    this.destroyRef.onDestroy(() => this.clearImage());
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
    if (mode === 'cinemas') {
      // There is no image search in the cinema mode.
      this.clearImage();
      this.loadProgramme();
    } else {
      this.runTextSearch(this.query());
    }
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

  /** Opens the file picker (on phones it also offers the camera); guests are asked to sign in. */
  protected pickImage(fileInput: HTMLInputElement): void {
    if (!this.session.isSignedIn()) {
      this.snackbar.show(this.transloco.translate('search_scan_signin_dialog_message'), {
        actionLabel: this.transloco.translate('profile_sign_in'),
        action: () =>
          void this.router.navigate(['/sign-in'], { queryParams: { next: this.router.url } }),
      });
      return;
    }
    fileInput.click();
  }

  protected onImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset, so picking the same file again still fires `change`.
    input.value = '';
    if (!file) return;
    this.clearImage();
    if (!file.type.startsWith('image/') || file.size > PICKED_MAX_BYTES) {
      this.visionError.set({ key: 'error_image_prepare', soft: false });
      return;
    }
    this.pickedImage = file;
    this.imagePreview.set(URL.createObjectURL(file));
    void this.analyzeImage();
  }

  protected retryImage(): void {
    if (this.pickedImage) void this.analyzeImage();
    else this.clearImage();
  }

  /** Removes the image, its result and any analysis still running. */
  protected clearImage(): void {
    this.imageRun++;
    this.visionSub?.unsubscribe();
    const preview = this.imagePreview();
    if (preview) URL.revokeObjectURL(preview);
    this.imagePreview.set(null);
    this.pickedImage = null;
    this.analyzing.set(false);
    this.visionResult.set(null);
    this.visionError.set(null);
  }

  private async analyzeImage(): Promise<void> {
    const file = this.pickedImage;
    if (!file) return;
    const run = ++this.imageRun;
    this.visionSub?.unsubscribe();
    this.visionResult.set(null);
    this.visionError.set(null);
    this.analyzing.set(true);

    let upload: Blob;
    try {
      upload = await compressImage(file, UPLOAD_MAX_DIMENSION, UPLOAD_MAX_BYTES);
    } catch {
      // E.g. a format the browser cannot decode (HEIC in most browsers).
      if (run !== this.imageRun) return;
      this.visionError.set({ key: 'error_image_prepare', soft: false });
      this.analyzing.set(false);
      return;
    }
    if (run !== this.imageRun) return;

    this.visionSub = this.visionApi.detect(upload).subscribe({
      next: (response) => {
        this.visionResult.set(response);
        this.analyzing.set(false);
      },
      error: (e) => {
        this.visionError.set(friendlyError(e, 'error_image_analysis'));
        this.analyzing.set(false);
      },
    });
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
