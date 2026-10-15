import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { SnackbarService } from '../../shared/ui/snackbar';

/** The browser's install prompt event (Chromium only, not in the TypeScript DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How often an open tab asks whether a new version was deployed. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * The installable app (PWA):
 * - a new deployed version is announced with a "Reload" message, so nobody keeps running an old
 *   build for days (the service worker would otherwise switch only after all tabs are closed);
 * - the browser's install prompt is kept, so the Profile page can offer "Install the app".
 *
 * The service worker only runs in production builds; in `npm start` this service does nothing.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private installEvent: BeforeInstallPromptEvent | null = null;

  /** True when the browser can install the app right now. */
  readonly canInstall = signal(false);

  constructor() {
    const window = this.document.defaultView;
    window?.addEventListener('beforeinstallprompt', (event) => {
      // Keep the event for our own button instead of the browser's mini-infobar.
      event.preventDefault();
      this.installEvent = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });
    window?.addEventListener('appinstalled', () => this.clearInstallPrompt());

    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() =>
        this.snackbar.show(this.transloco.translate('web_update_available'), {
          actionLabel: this.transloco.translate('web_update_reload'),
          action: () => this.reload(),
          persistent: true,
        }),
      );
    // The cached version can no longer be served (e.g. its files were removed): load fresh.
    this.updates.unrecoverable.subscribe(() => this.reload());

    setInterval(() => {
      if (this.document.visibilityState === 'visible') {
        this.updates.checkForUpdate().catch(() => undefined);
      }
    }, UPDATE_CHECK_MS);
  }

  /** Shows the browser's install dialog; resolves to true when the user installed the app. */
  async install(): Promise<boolean> {
    const event = this.installEvent;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The event can be used only once.
    this.clearInstallPrompt();
    return outcome === 'accepted';
  }

  private clearInstallPrompt(): void {
    this.installEvent = null;
    this.canInstall.set(false);
  }

  private reload(): void {
    this.document.location.reload();
  }
}
