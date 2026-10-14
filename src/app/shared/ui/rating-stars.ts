import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Ten stars, 1-10 like the backend (RatingStars.kt). Clicking star N rates N. For keyboard and screen
 * reader users the row is one slider ("Rating, 7 of 10") changed with the arrow keys, instead of ten
 * separate buttons.
 */
@Component({
  selector: 'app-rating-stars',
  imports: [TranslocoPipe],
  template: `
    <div
      class="stars"
      role="slider"
      tabindex="0"
      aria-valuemin="1"
      aria-valuemax="10"
      [attr.aria-valuenow]="value() || null"
      [attr.aria-valuetext]="
        value()
          ? ('rating_stars_state' | transloco: { p1: value() })
          : ('rating_stars_not_rated' | transloco)
      "
      [attr.aria-label]="'rating_stars_label' | transloco"
      [attr.aria-disabled]="disabled()"
      (keydown)="onKey($event)"
      (mouseleave)="hover.set(0)"
    >
      @for (star of stars; track star) {
        <button
          type="button"
          tabindex="-1"
          class="star"
          [class.on]="star <= shown()"
          [disabled]="disabled()"
          (mouseenter)="hover.set(star)"
          (click)="rate.emit(star)"
          [attr.aria-label]="'rating_stars_content_description' | transloco: { p1: star }"
        >
          <span class="icon" [class.filled]="star <= shown()" aria-hidden="true">star</span>
        </button>
      }
    </div>
  `,
  styles: `
    .stars {
      display: inline-flex;
      border-radius: var(--radius-sm);
    }
    .star {
      display: grid;
      place-items: center;
      width: 32px;
      height: 36px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      &.on {
        color: var(--gold);
      }
      &:disabled {
        cursor: default;
      }
      .icon {
        font-size: 26px;
      }
    }
    @media (max-width: 400px) {
      .star {
        width: 28px;
        .icon {
          font-size: 23px;
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingStars {
  /** Current rating 1-10, or 0 for "not rated". */
  readonly value = input(0);
  readonly disabled = input(false);
  readonly rate = output<number>();

  protected readonly stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly hover = signal(0);
  protected readonly shown = computed(() => this.hover() || this.value());

  protected onKey(event: KeyboardEvent): void {
    if (this.disabled()) return;
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    // Moving "down" from "not rated" must not create a rating of 1 by accident.
    if (!this.value() && step < 0) return;
    this.rate.emit(Math.min(10, Math.max(1, (this.value() || 0) + step)));
  }
}
