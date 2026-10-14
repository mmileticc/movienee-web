import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { MovieApi } from '../../core/api/movie-api';
import { friendlyError } from '../../core/http/friendly-error';
import { PersonMovieCredit } from '../../core/models/movie';
import { LanguageService } from '../../core/prefs/language.service';
import { formatDate, formatRating, yearsBetween } from '../../core/util/format';
import { releaseYear, tmdbImage } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';
import { ExpandableText } from '../../shared/ui/expandable-text';
import { ImageViewerService } from '../../shared/ui/image-viewer';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';
import { ErrorState, Spinner } from '../../shared/ui/states';

type FilmographySort = 'popularity' | 'newest' | 'oldest' | 'rating';

/**
 * Person page (ActorDetailScreen.kt): photo, short facts, biography and a sortable filmography.
 */
@Component({
  selector: 'app-person',
  imports: [TranslocoPipe, ExpandableText, MoviePosterCard, ErrorState, Spinner],
  templateUrl: './person.page.html',
  styleUrl: './person.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPage {
  private readonly movieApi = inject(MovieApi);
  private readonly imageViewer = inject(ImageViewerService);
  private readonly pageTitle = inject(PageTitle);
  protected readonly language = inject(LanguageService);

  /** Route parameter (`/person/:id`). */
  readonly id = input.required<string>();

  protected readonly sorts: FilmographySort[] = ['popularity', 'newest', 'oldest', 'rating'];
  protected readonly sort = signal<FilmographySort>('popularity');

  protected readonly person = rxResource({
    params: () => Number(this.id()),
    stream: ({ params }) => this.movieApi.person(params),
  });

  protected readonly error = computed(() =>
    this.person.error() ? friendlyError(this.person.error(), 'error_load_person') : null,
  );

  protected readonly photo = computed(() => tmdbImage(this.person.value()?.profile_path, 'w500'));

  protected readonly born = computed(() => {
    const p = this.person.value();
    if (!p?.birthday) return null;
    const date = formatDate(p.birthday, this.language.language());
    const age = p.deathday ? null : yearsBetween(p.birthday);
    return { date, age };
  });

  protected readonly died = computed(() => {
    const p = this.person.value();
    if (!p?.deathday) return null;
    const date = formatDate(p.deathday, this.language.language());
    const age = p.birthday ? yearsBetween(p.birthday, p.deathday) : null;
    return { date, age };
  });

  /** Filmography in the chosen order; the backend order is popularity (best-known roles first). */
  protected readonly credits = computed(() => {
    const credits = this.person.value()?.movie_credits ?? [];
    const byDate = (a: PersonMovieCredit, b: PersonMovieCredit) =>
      (a.release_date ?? '').localeCompare(b.release_date ?? '');
    // Movies without a date (announced, not scheduled) go last in both date directions.
    const dated = credits.filter((c) => !!c.release_date);
    const undated = credits.filter((c) => !c.release_date);
    switch (this.sort()) {
      case 'newest':
        return [...dated.sort(byDate).reverse(), ...undated];
      case 'oldest':
        return [...dated.sort(byDate), ...undated];
      case 'rating':
        return [...credits].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
      default:
        return credits;
    }
  });

  constructor() {
    effect(() => this.pageTitle.set(this.person.value()?.name));
  }

  protected openPhoto(): void {
    const p = this.person.value();
    const src = tmdbImage(p?.profile_path, 'original');
    if (p && src) this.imageViewer.open([src], 0, p.name);
  }

  protected caption(credit: PersonMovieCredit): string | null {
    // "2019 · Joker" - the year helps orientation in a long career.
    return [releaseYear(credit.release_date), credit.character].filter(Boolean).join(' · ') || null;
  }

  protected rating(value: number | null | undefined): string | null {
    return formatRating(value, this.language.language());
  }
}
