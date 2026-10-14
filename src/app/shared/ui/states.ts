import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FriendlyError } from '../../core/http/friendly-error';

/**
 * Error card (StateCards.kt). `retry` adds "Try again" - every error that can be retried should
 * have it. Soft errors (temporary, not the user's fault) are shown calmly, without red.
 */
@Component({
  selector: 'app-error-state',
  imports: [TranslocoPipe],
  template: `
    <div class="state" [class.soft]="error().soft" role="alert">
      <span class="icon" aria-hidden="true">{{ error().soft ? 'info' : 'error' }}</span>
      <p class="t-title">
        {{ (error().soft ? 'error_transient_title' : 'state_error_title') | transloco }}
      </p>
      <p class="t-body t-secondary">{{ error().message ?? (error().key ?? '' | transloco) }}</p>
      @if (retryable()) {
        <button class="btn" type="button" (click)="retry.emit()">
          {{ 'state_retry' | transloco }}
        </button>
      }
    </div>
  `,
  styleUrl: './states.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly error = input.required<FriendlyError>();
  readonly retryable = input(true);
  readonly retry = output<void>();
}

/** Empty state: a neutral icon, a title, a message and an optional projected action. */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="state">
      <span class="icon" aria-hidden="true">{{ icon() }}</span>
      <p class="t-title">{{ heading() }}</p>
      @if (message()) {
        <p class="t-body t-secondary">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styleUrl: './states.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('movie');
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
}

/** Centered loading indicator. */
@Component({
  selector: 'app-spinner',
  template: `<span class="spinner" role="status" aria-label="Loading"></span>`,
  styleUrl: './states.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner {}
