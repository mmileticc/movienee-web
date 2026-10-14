import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SocialApi } from '../../core/api/social-api';
import { SessionStore } from '../../core/auth/session.store';
import { friendlyError } from '../../core/http/friendly-error';
import { FriendProfileMovie, FriendshipStatus } from '../../core/models/social';
import { SocialStore } from '../../core/state/social.store';
import { PageTitle } from '../../core/util/page-title';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { SnackbarService } from '../../shared/ui/snackbar';
import { ErrorState, Spinner } from '../../shared/ui/states';
import { UserAvatar } from '../../shared/ui/user-avatar';

/**
 * Another user's profile (FriendProfileScreen). Until the friendship is accepted the backend returns a
 * limited preview (shared genres instead of the watched list). The fixed bottom bar holds the action
 * for the current status: add, cancel, accept/decline, or Movie Night for friends.
 */
@Component({
  selector: 'app-friend-profile',
  imports: [TranslocoPipe, RouterLink, UserAvatar, MovieListRow, ErrorState, Spinner],
  templateUrl: './friend-profile.page.html',
  styleUrl: './friend-profile.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendProfilePage {
  private readonly api = inject(SocialApi);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmService = inject(ConfirmService);
  private readonly snackbar = inject(SnackbarService);
  private readonly pageTitle = inject(PageTitle);
  private readonly session = inject(SessionStore);
  protected readonly social = inject(SocialStore);

  /** Route parameter (`/friends/:friendId`). */
  readonly friendId = input.required<string>();

  protected readonly profile = rxResource({
    params: () => this.friendId(),
    stream: ({ params }) => this.api.friendProfile(params),
  });
  protected readonly error = computed(() =>
    this.profile.error() ? friendlyError(this.profile.error(), 'error_load_profile') : null,
  );

  /** Old cached answers may lack the status; treat a missing one as "not friends". */
  protected readonly status = computed<FriendshipStatus>(
    () => this.profile.value()?.friendship_status ?? 'NONE',
  );
  protected readonly locked = computed(() => this.status() !== 'ACCEPTED');

  constructor() {
    effect(() => this.pageTitle.set(this.profile.value()?.username));
    // One's own profile lives on /profile.
    effect(() => {
      if (this.friendId() === this.session.userId()) void this.router.navigateByUrl('/profile');
    });
  }

  protected rating(movie: FriendProfileMovie): string {
    return movie.rating
      ? this.transloco.translate('library_my_rating', { p1: movie.rating })
      : this.transloco.translate('friend_profile_no_rating');
  }

  protected async add(): Promise<void> {
    const p = this.profile.value();
    if (!p) return;
    const ok = await this.social.sendRequest({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
    });
    this.after(ok, 'PENDING_SENT', 'error_send_request');
  }

  protected async cancel(): Promise<void> {
    const p = this.profile.value();
    if (
      !p ||
      !(await this.confirm(
        'profile_cancel_request_dialog_title',
        'profile_cancel_request_dialog_message',
        'profile_cancel_request',
      ))
    )
      return;
    this.after(await this.social.cancelRequest(p.id), 'NONE', 'error_cancel_request');
  }

  protected async accept(): Promise<void> {
    const p = this.profile.value();
    if (!p) return;
    const ok = await this.social.accept(p.id);
    if (ok)
      this.profile.reload(); // only now does the backend return the watched list
    else this.snackbar.show(this.transloco.translate('error_accept_request'));
  }

  protected async reject(): Promise<void> {
    const p = this.profile.value();
    if (
      !p ||
      !(await this.confirm(
        'profile_reject_request_dialog_title',
        'profile_reject_request_dialog_message',
        'profile_reject_content_description',
      ))
    )
      return;
    this.after(await this.social.reject(p.id), 'NONE', 'error_reject_request');
  }

  private after(ok: boolean, newStatus: FriendshipStatus, errorKey: string): void {
    if (!ok) {
      this.snackbar.show(this.transloco.translate(errorKey));
      return;
    }
    this.profile.update((p) => (p ? { ...p, friendship_status: newStatus } : p));
  }

  private confirm(titleKey: string, messageKey: string, confirmKey: string) {
    return this.confirmService.confirm({
      title: this.transloco.translate(titleKey),
      message: this.transloco.translate(messageKey, { p1: this.profile.value()?.username ?? '' }),
      confirmLabel: this.transloco.translate(confirmKey),
      cancelLabel: this.transloco.translate('profile_remove_cancel'),
      destructive: true,
    });
  }
}
