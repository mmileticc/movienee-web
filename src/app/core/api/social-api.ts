import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  FeedResponse,
  FriendAction,
  FriendActivity,
  FriendActivityResponse,
  FriendInfo,
  FriendProfileResponse,
  FriendsResponse,
  InviteAccepted,
  Inviter,
  MyInvite,
  MovieNightResponse,
  NotificationItem,
  NotificationsResponse,
  PendingRequest,
  PendingRequestsResponse,
  ShareMovieRequest,
  UserSearchResult,
  UserSearchResponse,
} from '../models/social';
import { UserScopedApi, apiUrl } from './api-base';

/** Friends, feed, invites, Movie Night, sharing and notifications. All require sign-in except `inviter`. */
@Injectable({ providedIn: 'root' })
export class SocialApi extends UserScopedApi {
  private readonly http = inject(HttpClient);

  /** User search for adding friends; the caller is taken from the JWT. */
  searchUsers(q: string): Observable<UserSearchResult[]> {
    return this.http
      .get<UserSearchResponse>(apiUrl('/api/users/search'), { params: { q } })
      .pipe(map((r) => r.users ?? []));
  }

  friends(): Observable<FriendInfo[]> {
    return this.http.get<FriendsResponse>(this.me('/friends')).pipe(map((r) => r.friends ?? []));
  }

  incomingRequests(): Observable<PendingRequest[]> {
    return this.http
      .get<PendingRequestsResponse>(this.me('/friends/pending'))
      .pipe(map((r) => r.requests ?? []));
  }

  sentRequests(): Observable<PendingRequest[]> {
    return this.http
      .get<PendingRequestsResponse>(this.me('/friends/pending/sent'))
      .pipe(map((r) => r.requests ?? []));
  }

  /** add / accept / reject. */
  friendAction(friendId: string, action: FriendAction): Observable<void> {
    return this.http.post<void>(this.me(`/friends/${encodeURIComponent(friendId)}`), { action });
  }

  /** Removes a friend, or cancels/rejects a request (the backend deletes the row in any direction). */
  removeFriend(friendId: string): Observable<void> {
    return this.http.delete<void>(this.me(`/friends/${encodeURIComponent(friendId)}`));
  }

  friendProfile(friendId: string): Observable<FriendProfileResponse> {
    return this.http.get<FriendProfileResponse>(
      this.me(`/friends/${encodeURIComponent(friendId)}/profile`),
    );
  }

  activity(): Observable<FriendActivity[]> {
    return this.http
      .get<FriendActivityResponse>(this.me('/friends/activity'))
      .pipe(map((r) => r.activities ?? []));
  }

  /** The friends feed; `before` = timestamp of the last item already shown (next page). */
  feed(before?: number): Observable<FeedResponse> {
    return this.http.get<FeedResponse>(this.me('/feed'), {
      params: before ? { before } : {},
    });
  }

  /** The user's own invite link (created on first use). */
  myInvite(): Observable<MyInvite> {
    return this.http.get<MyInvite>(this.me('/invite'));
  }

  /** A new invite link; the old one stops working. */
  resetInvite(): Observable<MyInvite> {
    return this.http.post<MyInvite>(this.me('/invite/reset'), {});
  }

  /** Who an invite link belongs to (works signed out). */
  inviter(code: string): Observable<Inviter> {
    return this.http.get<Inviter>(apiUrl(`/api/invite/${encodeURIComponent(code)}`));
  }

  /** Accepts an invite: the two users become friends right away. */
  acceptInvite(code: string): Observable<InviteAccepted> {
    return this.http.post<InviteAccepted>(
      apiUrl(`/api/invite/${encodeURIComponent(code)}/accept`),
      {},
    );
  }

  movieNight(friendId: string, page = 1): Observable<MovieNightResponse> {
    return this.http.get<MovieNightResponse>(
      this.me(`/friends/${encodeURIComponent(friendId)}/movienight-suggestions`),
      { params: { page } },
    );
  }

  /** Sends a movie to a friend (push notification + their Notifications list). */
  shareMovie(body: ShareMovieRequest): Observable<void> {
    return this.http.post<void>(this.me('/share'), body);
  }

  notifications(): Observable<NotificationItem[]> {
    return this.http
      .get<NotificationsResponse>(this.me('/notifications'))
      .pipe(map((r) => r.notifications ?? []));
  }

  markNotificationsRead(): Observable<void> {
    return this.http.post<void>(this.me('/notifications/read'), {});
  }
}
