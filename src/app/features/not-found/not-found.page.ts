import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="page not-found">
      <span class="icon" aria-hidden="true">movie_off</span>
      <h1 class="t-headline">{{ 'web_not_found_title' | transloco }}</h1>
      <p class="t-body-lg t-secondary">{{ 'web_not_found_body' | transloco }}</p>
      <a class="btn primary" routerLink="/">{{ 'web_back_home' | transloco }}</a>
    </section>
  `,
  styles: `
    .not-found {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      text-align: center;
      padding-top: var(--space-7);
    }
    .icon {
      font-size: 64px;
      color: var(--text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
