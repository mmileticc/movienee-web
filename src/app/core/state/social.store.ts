import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, Subscription, firstValueFrom, forkJoin } from 'rxjs';
import { SocialApi } from '../api/social-api';
import { SessionStore } from '../auth/session.store';
import { FriendlyError, friendlyError } from '../http/friendly-error';
import {
  FeedItem,
  FriendActivity,
  FriendInfo,
  FriendshipStatus,
  NotificationItem,
  PendingRequest,
  SharedWish,
  UserSearchResult,
} from '../models/social';

/** How often the unread badge is refreshed while the tab is visible. */
const POLL_MS = 60_000;

/**
 * Friends, friend requests, the activity feed and notifications of the signed-in user, shared by the
 * Friends page, friend profiles, Home and the navigation badges.
 *
 * Friendship actions on one user never overlap: while an action for a user is in flight, new taps
 * for that user are ignored (the button is disabled), so a request can never be cancelled midway and
 * leave the client and the server out of sync (the Android app learned this the hard way).
 */
@Injectable({ providedIn: 'root' })
export class SocialStore {
  private readonly api = inject(SocialApi);
  private readonly session = inject(SessionStore);
  private readonly document = inject(DOCUMENT);

  readonly friends = signal<FriendInfo[] | null>(null);
  readonly incoming = signal<PendingRequest[]>([]);
  readonly sent = signal<PendingRequest[]>([]);
  readonly activity = signal<FriendActivity[]>([]);
  readonly loading = signal(false);
  readonly error = signal<FriendlyError | null>(null);

  /** The friends feed (null until the first page arrived) and what we both want to watch. */
  readonly feed = signal<FeedItem[] | null>(null);
  readonly sharedWishes = signal<SharedWish[]>([]);
  readonly feedHasMore = signal(false);
  readonly feedLoading = signal(false);
  readonly feedError = signal<FriendlyError | null>(null);

  readonly notifications = signal<NotificationItem[] | null>(null);
  readonly unreadCount = computed(
    () => (this.notifications() ?? []).filter((n) => !n.isRead).length,
  );

  /** User ids with a friendship action in flight. */
  readonly busy = signal<ReadonlySet<string>>(new Set());
  /** Friendship statuses changed by actions in this session (newer than any search response). */
  private readonly changedStatus = signal<ReadonlyMap<string, FriendshipStatus>>(new Map());

  private owner: string | null = null;
  private loadSub?: Subscription;
  private feedSub?: Subscription;
  private notificationsSub?: Subscription;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor() {
    // Another account (or sign-out) never sees the previous user's data; the badges start polling.
    effect(() => this.syncOwner(this.session.userId()));
  }

  /** Friends, requests and activity (the Friends page). */
  load(): void {
    const userId = this.session.userId();
    this.syncOwner(userId);
    if (!userId) return;
    this.loading.set(true);
    this.error.set(null);
    this.loadSub?.unsubscribe();
    this.loadSub = forkJoin([
      this.api.friends(),
      this.api.incomingRequests(),
      this.api.sentRequests(),
      this.api.activity(),
    ]).subscribe({
      next: ([friends, incoming, sent, activity]) => {
        this.friends.set(friends);
        this.incoming.set(incoming);
        this.sent.set(sent);
        this.activity.set(activity);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(friendlyError(e, 'error_load_profile'));
        this.loading.set(false);
      },
    });
  }

  /** The first page of the feed (replaces what was shown). */
  loadFeed(): void {
    this.fetchFeed(undefined);
  }

  /** The next page, older than the last item shown. */
  loadMoreFeed(): void {
    const last = this.feed()?.at(-1);
    if (!last || this.feedLoading() || !this.feedHasMore()) return;
    this.fetchFeed(last.timestamp);
  }

  private fetchFeed(before: number | undefined): void {
    if (!this.session.isSignedIn()) return;
    this.feedSub?.unsubscribe();
    this.feedLoading.set(true);
    this.feedError.set(null);
    this.feedSub = this.api.feed(before).subscribe({
      next: (page) => {
        // A comment and a rating can share a timestamp across pages; ids keep cards unique.
        const known = new Set(before ? (this.feed() ?? []).map((i) => i.id) : []);
        const fresh = page.items.filter((i) => !known.has(i.id));
        this.feed.update((items) => (before ? [...(items ?? []), ...fresh] : fresh));
        if (!before) this.sharedWishes.set(page.shared_wishes ?? []);
        this.feedHasMore.set(page.has_more);
        this.feedLoading.set(false);
      },
      error: (e) => {
        this.feedError.set(friendlyError(e, 'error_load_profile'));
        this.feedLoading.set(false);
      },
    });
  }

  /** Notifications and the incoming requests (the two badges). Silent on errors. */
  refreshBadges(): void {
    if (!this.session.isSignedIn()) return;
    this.notificationsSub?.unsubscribe();
    this.notificationsSub = forkJoin([
      this.api.notifications(),
      this.api.incomingRequests(),
    ]).subscribe({
      next: ([notifications, incoming]) => {
        this.notifications.set(notifications);
        this.incoming.set(incoming);
      },
      error: () => undefined,
    });
  }

  /** Marks everything read on the server; the list keeps its "new" highlight until the next load. */
  markNotificationsRead(): void {
    if (this.unreadCount() === 0) return;
    this.api.markNotificationsRead().subscribe({
      next: () =>
        this.notifications.update((list) => (list ?? []).map((n) => ({ ...n, isRead: true }))),
      error: () => undefined,
    });
  }

  isBusy(userId: string): boolean {
    return this.busy().has(userId);
  }

  /** Sends a friend request (from search results or a profile). */
  sendRequest(user: { id: string; username?: string | null; avatar_url?: string | null }) {
    return this.run(user.id, this.api.friendAction(user.id, 'add'), 'PENDING_SENT', () =>
      this.sent.update((list) =>
        list.some((r) => r.id === user.id)
          ? list
          : [{ id: user.id, username: user.username, avatar_url: user.avatar_url }, ...list],
      ),
    );
  }

  /** Withdraws a sent request (the backend removes the row in any direction). */
  cancelRequest(userId: string) {
    return this.run(userId, this.api.removeFriend(userId), 'NONE', () =>
      this.sent.update((list) => list.filter((r) => r.id !== userId)),
    );
  }

  accept(userId: string) {
    return this.run(userId, this.api.friendAction(userId, 'accept'), 'ACCEPTED', () => {
      this.incoming.update((list) => list.filter((r) => r.id !== userId));
      // Only now does the backend return the friend with match data; reload the lists quietly.
      if (this.friends() !== null) this.load();
    });
  }

  reject(userId: string) {
    return this.run(userId, this.api.friendAction(userId, 'reject'), 'NONE', () =>
      this.incoming.update((list) => list.filter((r) => r.id !== userId)),
    );
  }

  removeFriend(userId: string) {
    return this.run(userId, this.api.removeFriend(userId), 'NONE', () =>
      this.friends.update((list) => (list ?? []).filter((f) => f.friend_id !== userId)),
    );
  }

  /**
   * The friendship status of a search result: the server's answer, unless an action in this session
   * changed it afterwards.
   */
  statusOf(result: UserSearchResult): FriendshipStatus {
    return this.changedStatus().get(result.id) ?? result.status;
  }

  /**
   * Runs one action for a user: ignored while another action for that user is in flight; the local
   * lists change only after the server confirmed. Resolves to false when the server refused.
   */
  private async run(
    userId: string,
    request: Observable<void>,
    newStatus: FriendshipStatus,
    onSuccess: () => void,
  ): Promise<boolean> {
    if (this.isBusy(userId)) return false;
    this.setBusy(userId, true);
    try {
      await firstValueFrom(request, { defaultValue: undefined });
      this.changedStatus.update((current) => new Map(current).set(userId, newStatus));
      onSuccess();
      return true;
    } catch {
      return false;
    } finally {
      this.setBusy(userId, false);
    }
  }

  /** Clears everything when the signed-in account changes (or on sign-out). */
  private syncOwner(userId: string | null): void {
    if (userId === this.owner) return;
    this.owner = userId;
    this.loadSub?.unsubscribe();
    this.notificationsSub?.unsubscribe();
    this.feedSub?.unsubscribe();
    this.feed.set(null);
    this.sharedWishes.set([]);
    this.feedHasMore.set(false);
    this.feedLoading.set(false);
    this.feedError.set(null);
    this.friends.set(null);
    this.incoming.set([]);
    this.sent.set([]);
    this.activity.set([]);
    this.notifications.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.busy.set(new Set());
    this.changedStatus.set(new Map());
    this.stopPolling();
    if (userId) this.startPolling();
  }

  private setBusy(userId: string, busy: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (busy) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  private startPolling(): void {
    this.refreshBadges();
    this.pollTimer = setInterval(() => {
      if (this.document.visibilityState === 'visible') this.refreshBadges();
    }, POLL_MS);
  }

  private stopPolling(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
}
