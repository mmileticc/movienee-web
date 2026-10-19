import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SocialApi } from '../../core/api/social-api';
import { SessionStore } from '../../core/auth/session.store';
import { friendlyError } from '../../core/http/friendly-error';
import { SocialStore } from '../../core/state/social.store';
import { PageTitle } from '../../core/util/page-title';
import { ErrorState, Spinner } from '../../shared/ui/states';
import { UserAvatar } from '../../shared/ui/user-avatar';

type Outcome = 'accepted' | 'already' | null;

/**
 * The page behind a shared invite link (`/invite/{code}`, reached from `https://<backend>/i/{code}`):
 * who invites, and "Add as friend" - which makes the two friends right away. Signed-out visitors
 * sign in first and come back here.
 */
@Component({
  selector: 'app-invite',
  imports: [TranslocoPipe, RouterLink, UserAvatar, ErrorState, Spinner],
  template: `
    <section class="page invite">
      @if (inviter.isLoading()) {
        <app-spinner />
      } @else if (invalid()) {
        <span class="icon big" aria-hidden="true">link_off</span>
        <p class="t-body-lg">{{ 'invite_invalid' | transloco }}</p>
        <a class="btn" routerLink="/">{{ 'web_back_home' | transloco }}</a>
      } @else if (loadError(); as e) {
        <app-error-state [error]="e" (retry)="inviter.reload()" />
      } @else if (inviter.value(); as who) {
        <app-user-avatar [url]="who.avatar_url" [name]="who.username" [size]="96" />
        <h1 class="t-headline">{{ 'invite_page_title' | transloco: { p1: name() } }}</h1>
        <p class="t-body-lg t-secondary">{{ 'invite_page_message' | transloco }}</p>

        @if (who.inviter_id === session.userId()) {
          <p class="t-body">{{ 'invite_own' | transloco }}</p>
          <a class="btn" routerLink="/friends">{{ 'nav_friends' | transloco }}</a>
        } @else if (outcome(); as done) {
          <p class="t-title done">
            {{ (done === 'accepted' ? 'invite_accepted' : 'invite_already_friends') | transloco }}
          </p>
          <a class="btn primary" [routerLink]="['/friends', who.inviter_id]">
            {{ 'invite_open_profile' | transloco }}
          </a>
        } @else if (session.isSignedIn()) {
          <button class="btn primary" type="button" [disabled]="busy()" (click)="accept()">
            <span class="icon" aria-hidden="true">person_add</span>
            {{ 'invite_accept' | transloco }}
          </button>
        } @else {
          <a
            class="btn primary"
            routerLink="/sign-in"
            [queryParams]="{ next: '/invite/' + code() }"
          >
            {{ 'invite_sign_in' | transloco }}
          </a>
        }
        @if (acceptError(); as message) {
          <p class="t-body error" role="alert">{{ message }}</p>
        }
      }
    </section>
  `,
  styles: `
    .invite {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      max-width: 520px;
      text-align: center;
      padding-top: var(--space-7);
    }
    .big {
      font-size: 64px;
      color: var(--text-muted);
    }
    .done {
      color: var(--success);
    }
    .error {
      color: var(--error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitePage {
  private readonly api = inject(SocialApi);
  private readonly social = inject(SocialStore);
  private readonly transloco = inject(TranslocoService);
  protected readonly session = inject(SessionStore);

  readonly code = input.required<string>();

  protected readonly inviter = rxResource({
    params: () => this.code(),
    stream: ({ params }) => this.api.inviter(params),
  });
  protected readonly invalid = computed(() => {
    const error = this.inviter.error() as { cause?: unknown } | undefined;
    const http = error instanceof HttpErrorResponse ? error : error?.cause;
    return http instanceof HttpErrorResponse && http.status === 404;
  });
  protected readonly loadError = computed(() =>
    this.inviter.error() ? friendlyError(this.inviter.error(), 'error_load_profile') : null,
  );
  protected readonly name = computed(
    () =>
      this.inviter.value()?.username ||
      this.transloco.translate<string>('profile_default_username'),
  );

  protected readonly busy = signal(false);
  protected readonly outcome = signal<Outcome>(null);
  protected readonly acceptError = signal<string | null>(null);

  constructor() {
    inject(PageTitle).set(this.transloco.translate('invite_title'));
  }

  protected accept(): void {
    this.busy.set(true);
    this.acceptError.set(null);
    this.api.acceptInvite(this.code()).subscribe({
      next: (result) => {
        this.outcome.set(result.already_friends ? 'already' : 'accepted');
        this.busy.set(false);
        // The new friend shows up in the lists and the feed right away.
        this.social.load();
        this.social.loadFeed();
      },
      error: (e) => {
        const error = friendlyError(e, 'error_send_request');
        this.acceptError.set(
          error.message ?? this.transloco.translate(error.key ?? 'error_server'),
        );
        this.busy.set(false);
      },
    });
  }
}
