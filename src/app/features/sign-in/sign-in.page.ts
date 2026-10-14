import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, map, of } from 'rxjs';
import { MovieApi } from '../../core/api/movie-api';
import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session.store';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { tmdbImage } from '../../core/util/image-url';
import { PageTitle } from '../../core/util/page-title';

/**
 * Google sign-in (SignInScreen). After signing in the user returns to `next` (the page that asked for
 * an account) or Home. The poster collage behind is purely decorative: if it fails to load, the page
 * is just the gradient.
 */
@Component({
  selector: 'app-sign-in',
  imports: [TranslocoPipe, RouterLink],
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Query parameter: where to go after signing in. */
  readonly next = input<string | undefined>();

  protected readonly busy = signal(false);
  protected readonly error = signal<FriendlyError | null>(null);

  protected readonly posters = toSignal(
    inject(MovieApi)
      .trending(1)
      .pipe(
        map((movies) =>
          movies.map((m) => tmdbImage(m.poster_path, 'w185')).filter((src): src is string => !!src),
        ),
        catchError(() => of<string[]>([])),
      ),
    { initialValue: [] },
  );

  constructor() {
    inject(PageTitle).set(inject(TranslocoService).translate('profile_sign_in'));
  }

  ngOnInit(): void {
    if (this.session.isSignedIn()) {
      this.leave();
      return;
    }
    // Returning from a redirect sign-in (used only when the popup was blocked).
    this.busy.set(true);
    this.auth
      .completeRedirectSignIn()
      .then((signedIn) => (signedIn ? this.leave() : this.busy.set(false)))
      .catch((e) => this.fail(e));
  }

  protected async signIn(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
      if (this.session.isSignedIn()) this.leave();
    } catch (e) {
      // Closing the Google window is not an error.
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        this.busy.set(false);
        return;
      }
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    this.error.set(friendlyError(e, 'sign_in_google_failed'));
    this.busy.set(false);
  }

  /** Only app-internal paths are accepted as `next` (no open redirects). */
  private leave(): void {
    const next = this.next();
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
