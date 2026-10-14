import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { tmdbImage } from '../../core/util/image-url';

/**
 * Compact vertical movie card (poster + title + optional caption) for horizontal rows and grids
 * (MoviePosterCard.kt). Takes plain values, so every screen maps its own model.
 */
@Component({
  selector: 'app-movie-poster-card',
  imports: [RouterLink],
  template: `
    <a class="card" [routerLink]="['/movie', movieId()]" (click)="opened.emit()">
      <div class="poster">
        @if (posterUrl(); as src) {
          <img [src]="src" [alt]="title()" loading="lazy" decoding="async" />
        } @else {
          <span class="icon" aria-hidden="true">movie</span>
        }
        @if (rating(); as value) {
          <span class="rating"
            ><span class="icon filled" aria-hidden="true">star</span>{{ value }}</span
          >
        }
      </div>
      <span class="title">{{ title() }}</span>
      @if (caption()) {
        <span class="caption">{{ caption() }}</span>
      }
    </a>
  `,
  styleUrl: './movie-poster-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoviePosterCard {
  readonly movieId = input.required<number>();
  readonly title = input.required<string>();
  readonly posterPath = input<string | null | undefined>(null);
  /** Already formatted rating text, e.g. "8.4". */
  readonly rating = input<string | null>(null);
  readonly caption = input<string | null | undefined>(null);
  /** The user opened the movie (e.g. Search records the query only then). */
  readonly opened = output<void>();

  protected readonly posterUrl = computed(() => tmdbImage(this.posterPath(), 'w342'));
}
