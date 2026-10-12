import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Temporary page for routes whose screen is not built yet; the title comes from the route data. */
@Component({
  selector: 'app-under-construction',
  imports: [TranslocoPipe],
  template: `
    <section class="page">
      <h1 class="t-headline">{{ titleKey() | transloco }}</h1>
      <p class="t-body-lg t-secondary hint">{{ 'web_under_construction' | transloco }}</p>
    </section>
  `,
  styles: `
    .hint {
      margin-top: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnderConstructionPage {
  /** Bound from the route's `data.titleKey` (withComponentInputBinding). */
  readonly titleKey = input('app_name');
}
