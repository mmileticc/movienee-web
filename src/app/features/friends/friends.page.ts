import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { SocialApi } from '../../core/api/social-api';
import { FriendlyError, friendlyError } from '../../core/http/friendly-error';
import { FriendActivity, PendingRequest, UserSearchResult } from '../../core/models/social';
import { SocialStore } from '../../core/state/social.store';
import { PageTitle } from '../../core/util/page-title';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { MovieListRow } from '../../shared/ui/movie-list-row';
import { SnackbarService } from '../../shared/ui/snackbar';
import { EmptyState, ErrorState, Spinner } from '../../shared/ui/states';
import { UserAvatar } from '../../shared/ui/user-avatar';

const MIN_QUERY_LENGTH = 2;

/**
 * Friends (FriendsScreen): incoming requests first (so typing in the search never pushes them away),
 * user search with an action per friendship status, sent requests, the friend list and the friends'
 * activity. Irreversible actions (reject, cancel, remove) ask for confirmation.
 */
@Component({
  selector: 'app-friends',
  imports: [TranslocoPipe, RouterLink, UserAvatar, MovieListRow, ErrorState, EmptyState, Spinner],
  templateUrl: './friends.page.html',
  styleUrl: './friends.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsPage implements OnInit {
  private readonly api = inject(SocialApi);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmService = inject(ConfirmService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly social = inject(SocialStore);

  protected readonly query = signal('');
  protected readonly results = signal<UserSearchResult[] | null>(null);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<FriendlyError | null>(null);
  private readonly typed$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor() {
    inject(PageTitle).set(this.transloco.translate('friends_top_bar_title'));
  }

  ngOnInit(): void {
    this.social.load();
    this.typed$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.search(q));
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.typed$.next(value.trim());
  }

  protected async accept(request: PendingRequest): Promise<void> {
    if (!(await this.social.accept(request.id))) this.fail('error_accept_request');
  }

  protected async reject(request: PendingRequest): Promise<void> {
    const name = this.displayName(request.username);
    if (
      !(await this.confirm(
        'profile_reject_request_dialog_title',
        'profile_reject_request_dialog_message',
        name,
        'profile_reject_content_description',
      ))
    )
      return;
    if (!(await this.social.reject(request.id))) this.fail('error_reject_request');
  }

  protected async cancel(user: { id: string; username?: string | null }): Promise<void> {
    const name = this.displayName(user.username);
    if (
      !(await this.confirm(
        'profile_cancel_request_dialog_title',
        'profile_cancel_request_dialog_message',
        name,
        'profile_cancel_request',
      ))
    )
      return;
    if (!(await this.social.cancelRequest(user.id))) this.fail('error_cancel_request');
  }

  protected async add(user: UserSearchResult): Promise<void> {
    if (!(await this.social.sendRequest(user))) this.fail('error_send_request');
  }

  protected async remove(friendId: string, name: string): Promise<void> {
    if (
      !(await this.confirm(
        'profile_remove_friend_dialog_title',
        'profile_remove_friend_dialog_message',
        name,
        'profile_remove_confirm',
      ))
    )
      return;
    if (!(await this.social.removeFriend(friendId))) this.fail('error_remove_friend');
  }

  protected percent(value: number): number {
    return Math.round(value);
  }

  protected activityText(activity: FriendActivity): string {
    const rating = activity.metadata.rating;
    return activity.action === 'rated' && rating
      ? this.transloco.translate('profile_activity_row_rated', {
          p1: activity.friend_name,
          p2: rating,
        })
      : this.transloco.translate('profile_activity_row_watched', { p1: activity.friend_name });
  }

  private search(q: string): void {
    this.searchSub?.unsubscribe();
    this.searchError.set(null);
    if (q.length < MIN_QUERY_LENGTH) {
      this.results.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchSub = this.api.searchUsers(q).subscribe({
      next: (users) => {
        this.results.set(users);
        this.searching.set(false);
      },
      error: (e) => {
        // A network failure must not look like "no users with that name".
        this.searchError.set(friendlyError(e, 'error_user_search'));
        this.searching.set(false);
      },
    });
  }

  private confirm(titleKey: string, messageKey: string, name: string, confirmKey: string) {
    return this.confirmService.confirm({
      title: this.transloco.translate(titleKey),
      message: this.transloco.translate(messageKey, { p1: name }),
      confirmLabel: this.transloco.translate(confirmKey),
      cancelLabel: this.transloco.translate('profile_remove_cancel'),
      destructive: true,
    });
  }

  private displayName(username: string | null | undefined): string {
    return username || this.transloco.translate<string>('profile_default_username');
  }

  private fail(key: string): void {
    this.snackbar.show(this.transloco.translate(key));
  }
}
