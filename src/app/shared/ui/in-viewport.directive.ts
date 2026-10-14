import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';

/**
 * Emits `inViewport` when the element scrolls into view (or close to it, see `rootMargin`). Used as
 * the sentinel at the end of infinite lists.
 *
 * IntersectionObserver reports only changes: a sentinel that stays visible after a page loads (a
 * short page, a tall screen) would never fire again. Bind `watch` to something that changes when
 * content is added (e.g. the item count) - if the sentinel is still visible then, it fires again.
 */
@Directive({ selector: '[appInViewport]' })
export class InViewportDirective implements OnInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private visible = false;

  /** How far before the element becomes visible the event fires. */
  readonly rootMargin = input('400px');
  readonly watch = input<unknown>(null);
  readonly inViewport = output<void>();

  constructor() {
    effect(() => {
      this.watch();
      // Let the new content render first, then check whether the sentinel is still in view.
      untracked(() => setTimeout(() => this.visible && this.inViewport.emit()));
    });
  }

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) this.inViewport.emit();
      },
      { rootMargin: this.rootMargin() },
    );
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
