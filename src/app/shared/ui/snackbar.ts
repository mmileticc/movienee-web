import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

interface SnackbarMessage {
  id: number;
  text: string;
  actionLabel?: string;
  action?: () => void;
  /** Called when the message disappears without the action being used (e.g. commit a removal). */
  onDismiss?: () => void;
}

const DURATION_MS = 5000;

/**
 * Short messages at the bottom of the screen, optionally with one action ("Undo"). A new message
 * replaces the current one, which counts as dismissed (its onDismiss runs).
 */
@Injectable({ providedIn: 'root' })
export class SnackbarService {
  readonly current = signal<SnackbarMessage | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private nextId = 1;

  show(text: string, options: Omit<SnackbarMessage, 'id' | 'text'> = {}): void {
    this.dismiss();
    this.current.set({ id: this.nextId++, text, ...options });
    this.timer = setTimeout(() => this.dismiss(), DURATION_MS);
  }

  /** Runs the action and closes the message without calling onDismiss. */
  act(): void {
    const message = this.current();
    clearTimeout(this.timer);
    this.current.set(null);
    message?.action?.();
  }

  dismiss(): void {
    const message = this.current();
    clearTimeout(this.timer);
    this.current.set(null);
    message?.onDismiss?.();
  }
}

/** Renders the current snackbar message (placed once, in the app shell). */
@Component({
  selector: 'app-snackbar',
  template: `
    @if (snackbar.current(); as message) {
      <div class="snackbar" role="status">
        <span>{{ message.text }}</span>
        @if (message.actionLabel) {
          <button type="button" (click)="snackbar.act()">{{ message.actionLabel }}</button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      left: 50%;
      bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
      translate: -50% 0;
      z-index: 50;
      width: min(560px, 100% - 2 * var(--space-4));
    }
    .snackbar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--text);
      color: var(--bg);
      box-shadow: var(--shadow-1);
      animation: rise 0.2s ease-out;
      span {
        flex: 1;
      }
      button {
        border: 0;
        background: none;
        color: var(--accent);
        font-weight: 700;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
    }
    @keyframes rise {
      from {
        transform: translateY(12px);
        opacity: 0;
      }
    }
    @media (max-width: 760px) {
      :host {
        bottom: calc(var(--bottombar-h) + var(--space-3) + env(safe-area-inset-bottom));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Snackbar {
  protected readonly snackbar = inject(SnackbarService);
}
