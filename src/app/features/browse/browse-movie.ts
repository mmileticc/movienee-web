import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrowseViewMode } from '../../core/prefs/browse-prefs.service';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { MoviePosterCard } from '../../shared/ui/movie-poster-card';

/** Shared UI model of the "See all" screens; each screen maps its own API model into it. */
export interface BrowseMovie {
  id: number;
  title: string;
  posterPath: string | null | undefined;
  /** Formatted rating, e.g. "8.4". */
  rating: string | null;
  year: string | null;
  genres: string[];
  overview: string | null | undefined;
  /** E.g. "Cineplexx, Cine Grand +2" on the cinema screen. */
  subtitle: string | null;
}

/** The movies in the selected view mode: a poster grid or a list with details. */
@Component({
  selector: 'app-browse-list',
  imports: [MoviePosterCard, MovieListRow],
  template: `
    @if (viewMode() === 'grid') {
      <div class="poster-grid">
        @for (movie of movies(); track movie.id) {
          <app-movie-poster-card
            [movieId]="movie.id"
            [title]="movie.title"
            [posterPath]="movie.posterPath"
            [rating]="movie.rating"
            [caption]="movie.subtitle ?? movie.year"
          />
        }
      </div>
    } @else {
      <div class="list-stack">
        @for (movie of movies(); track movie.id) {
          <app-movie-list-row
            [movieId]="movie.id"
            [title]="movie.title"
            [posterPath]="movie.posterPath"
            [meta]="meta(movie)"
            [description]="movie.overview"
          >
            @if (movie.subtitle) {
              <span extra class="t-small cinemas">{{ movie.subtitle }}</span>
            }
          </app-movie-list-row>
        }
      </div>
    }
  `,
  styles: `
    .cinemas {
      color: var(--gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseList {
  readonly movies = input.required<BrowseMovie[]>();
  readonly viewMode = input.required<BrowseViewMode>();

  /** "★ 8.4 · 2026 · Drama, Comedy" - missing parts are skipped. */
  protected meta(movie: BrowseMovie): string {
    return [movie.rating && `★ ${movie.rating}`, movie.year, movie.genres.slice(0, 3).join(', ')]
      .filter(Boolean)
      .join(' · ');
  }
}

/** "Cineplexx, Cine Grand +2" - the first two cinemas, then the number of the rest. */
export function cinemasSubtitle(cinemas: string[]): string | null {
  if (cinemas.length === 0) return null;
  const shown = cinemas.slice(0, 2).join(', ');
  return cinemas.length > 2 ? `${shown} +${cinemas.length - 2}` : shown;
}
