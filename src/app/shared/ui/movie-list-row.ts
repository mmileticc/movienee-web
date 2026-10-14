import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { tmdbImage } from '../../core/util/image-url';

/**
 * Horizontal movie row: poster, title, a meta line, an optional description and a `trailing` slot
 * (MovieListRow.kt). The whole row links to the movie.
 */
@Component({
  selector: 'app-movie-list-row',
  imports: [RouterLink],
  template: `
    <a class="row" [routerLink]="['/movie', movieId()]">
      <div class="poster">
        @if (posterUrl(); as src) {
          <img [src]="src" [alt]="title()" loading="lazy" decoding="async" />
        } @else {
          <span class="icon" aria-hidden="true">movie</span>
        }
      </div>
      <div class="body">
        <span class="title">{{ title() }}</span>
        @if (meta()) {
          <span class="meta">{{ meta() }}</span>
        }
        @if (description()) {
          <p class="description">{{ description() }}</p>
        }
        <ng-content select="[extra]" />
      </div>
    </a>
    <ng-content />
  `,
  styleUrl: './movie-list-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieListRow {
  readonly movieId = input.required<number>();
  readonly title = input.required<string>();
  readonly posterPath = input<string | null | undefined>(null);
  readonly meta = input<string | null | undefined>(null);
  readonly description = input<string | null | undefined>(null);

  protected readonly posterUrl = computed(() => tmdbImage(this.posterPath(), 'w185'));
}
