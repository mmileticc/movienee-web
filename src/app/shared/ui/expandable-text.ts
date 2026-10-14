import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Long text collapsed to `lines`, with "Show more/less". The button appears only when the text is
 * really cut off (measured, not guessed by length), so short texts never get a useless toggle.
 */
@Component({
  selector: 'app-expandable-text',
  imports: [TranslocoPipe],
  template: `
    <p
      #paragraph
      class="text t-body-lg"
      [class.clamped]="!expanded()"
      [style.-webkit-line-clamp]="lines()"
    >
      {{ text() }}
    </p>
    @if (overflowing() || expanded()) {
      <button class="toggle" type="button" (click)="expanded.set(!expanded())">
        {{ (expanded() ? 'actor_detail_show_less' : 'actor_detail_show_more') | transloco }}
      </button>
    }
  `,
  styles: `
    .text {
      white-space: pre-line;
      color: var(--text-2);
    }
    .clamped {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .toggle {
      margin-top: var(--space-2);
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent-text);
      font-weight: 600;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpandableText implements AfterViewInit, OnDestroy {
  readonly text = input.required<string>();
  readonly lines = input(5);

  private readonly element = viewChild.required<ElementRef<HTMLElement>>('paragraph');
  private observer?: ResizeObserver;
  protected readonly expanded = signal(false);
  protected readonly overflowing = signal(false);

  ngAfterViewInit(): void {
    const el = this.element().nativeElement;
    const measure = () => {
      if (!this.expanded()) this.overflowing.set(el.scrollHeight > el.clientHeight + 1);
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(measure);
      this.observer.observe(el);
    }
    measure();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
