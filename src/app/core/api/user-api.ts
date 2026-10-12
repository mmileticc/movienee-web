import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  AddToHistoryRequest,
  GenreAffinity,
  HistoryItem,
  HistoryResponse,
  TasteProfileResponse,
  UpdateHistoryRequest,
  UpdateProfileRequest,
  UserProfile,
  WatchlistItem,
  WatchlistResponse,
} from '../models/user';
import { UserScopedApi } from './api-base';

/** The signed-in user's own data: profile, watchlist, watched history and taste profile. */
@Injectable({ providedIn: 'root' })
export class UserApi extends UserScopedApi {
  private readonly http = inject(HttpClient);

  profile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.me());
  }

  updateProfile(body: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(this.me('/profile'), body);
  }

  watchlist(): Observable<WatchlistItem[]> {
    return this.http.get<WatchlistResponse>(this.me('/watchlist')).pipe(map((r) => r.items ?? []));
  }

  addToWatchlist(tmdbId: number): Observable<WatchlistItem> {
    return this.http.post<WatchlistItem>(this.me('/watchlist'), { tmdbId });
  }

  removeFromWatchlist(tmdbId: number): Observable<void> {
    return this.http.delete<void>(this.me(`/watchlist/${tmdbId}`));
  }

  history(): Observable<HistoryItem[]> {
    return this.http.get<HistoryResponse>(this.me('/history')).pipe(map((r) => r.items ?? []));
  }

  /** "Mark as watched"; rating/duration null = watched without them. */
  addToHistory(body: AddToHistoryRequest): Observable<HistoryItem> {
    return this.http.post<HistoryItem>(this.me('/history'), body);
  }

  /** null fields keep the existing value. */
  updateHistory(tmdbId: number, body: UpdateHistoryRequest): Observable<HistoryItem> {
    return this.http.put<HistoryItem>(this.me(`/history/${tmdbId}`), body);
  }

  /** Undo "watched" - also removes the rating. */
  removeFromHistory(tmdbId: number): Observable<void> {
    return this.http.delete<void>(this.me(`/history/${tmdbId}`));
  }

  tasteProfile(): Observable<GenreAffinity[]> {
    return this.http
      .get<TasteProfileResponse>(this.me('/taste-profile'))
      .pipe(map((r) => r.genres ?? []));
  }
}
