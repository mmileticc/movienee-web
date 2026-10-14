import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * A titled, horizontally scrolling row (the Home rows, cast, images). Cards are projected; on
 * pointer devices arrow buttons scroll by one "page".
 */
@Component({
  selector: 'app-poster-row',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="row">
      <header class="head">
        <h2 class="t-title-lg">{{ heading() }}</h2>
        @if (seeAllLink(); as link) {
          <a class="see-all" [routerLink]="link">{{ 'home_see_all' | transloco }}</a>
        }
        <div class="arrows">
          <button
            class="icon-btn"
            type="button"
            [disabled]="atStart()"
            (click)="scrollBy(-1)"
            [attr.aria-label]="'action_back' | transloco"
          >
            <span class="icon" aria-hidden="true">chevron_left</span>
          </button>
          <button
            class="icon-btn"
            type="button"
            [disabled]="atEnd()"
            (click)="scrollBy(1)"
            aria-label="→"
          >
            <span class="icon" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </header>
      <div class="track" [class.wide]="wide()" #track (scroll)="updateEdges()">
        <ng-content />
      </div>
    </section>
  `,
  styleUrl: './poster-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosterRow {
  readonly heading = input.required<string>();
  readonly seeAllLink = input<string | null>(null);
  /** Wider items (e.g. backdrop images) instead of poster-sized ones. */
  readonly wide = input(false);

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);

  protected scrollBy(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  protected updateEdges(): void {
    const el = this.track().nativeElement;
    this.atStart.set(el.scrollLeft <= 4);
    this.atEnd.set(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }
}
