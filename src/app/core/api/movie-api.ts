import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import {
  Genre,
  GenreListResponse,
  LikeCommentResponse,
  MovieComment,
  MovieCommentsResponse,
  MovieDetail,
  MovieListResponse,
  MovieSummary,
  NowInCinemasMovie,
  NowInCinemasResponse,
  PersonDetail,
} from '../models/movie';
import { FriendWatched, FriendsWatchedResponse } from '../models/social';
import { apiUrl } from './api-base';

/** Public movie data: search, lists, cinema programme, details, people and comments. */
@Injectable({ providedIn: 'root' })
export class MovieApi {
  private readonly http = inject(HttpClient);
  private genres$?: Observable<Genre[]>;

  search(query: string): Observable<MovieSummary[]> {
    return this.http
      .get<MovieListResponse>(apiUrl('/api/movies/search'), { params: { query } })
      .pipe(map((r) => r.results ?? []));
  }

  trending(page = 1): Observable<MovieSummary[]> {
    return this.http
      .get<MovieListResponse>(apiUrl('/api/movies/trending'), { params: { page } })
      .pipe(map((r) => r.results ?? []));
  }

  /** Personalized for a signed-in user (the token is added by the interceptor), popular otherwise. */
  featured(page = 1): Observable<MovieSummary[]> {
    return this.http
      .get<MovieListResponse>(apiUrl('/api/movies/featured'), { params: { page } })
      .pipe(map((r) => r.results ?? []));
  }

  /** All TMDB genres; they do not change during a session, so the first response is reused. */
  genres(): Observable<Genre[]> {
    this.genres$ ??= this.http.get<GenreListResponse>(apiUrl('/api/movies/genres')).pipe(
      map((r) => r.genres ?? []),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.genres$;
  }

  nowInCinemas(): Observable<NowInCinemasMovie[]> {
    return this.http
      .get<NowInCinemasResponse>(apiUrl('/api/movies/now-in-cinemas'))
      .pipe(map((r) => r.results ?? []));
  }

  /** Semantic ("mood") search over the movies currently in cinemas. */
  semanticSearchInCinemas(
    q: string,
    engine: 'gemini' | 'local' = 'gemini',
  ): Observable<NowInCinemasMovie[]> {
    if (!q.trim()) return of([]);
    return this.http
      .get<NowInCinemasResponse>(apiUrl('/api/movies/now-in-cinemas/semantic-search'), {
        params: { q, engine },
      })
      .pipe(map((r) => r.results ?? []));
  }

  /** `lat`/`lon` (optional) make the backend sort cinemas by distance. */
  detail(tmdbId: number, location?: { lat: number; lon: number }): Observable<MovieDetail> {
    let params = new HttpParams();
    if (location) params = params.set('lat', location.lat).set('lon', location.lon);
    return this.http.get<MovieDetail>(apiUrl(`/api/movies/${tmdbId}`), { params });
  }

  person(personId: number): Observable<PersonDetail> {
    return this.http.get<PersonDetail>(apiUrl(`/api/people/${personId}`));
  }

  /** Requires sign-in. */
  friendsWhoWatched(tmdbId: number): Observable<FriendWatched[]> {
    return this.http
      .get<FriendsWatchedResponse>(apiUrl(`/api/movies/${tmdbId}/friends-watched`))
      .pipe(map((r) => r.friends ?? []));
  }

  /** Public; with a token the own/friend/liked markers are filled in. */
  comments(tmdbId: number, offset = 0, limit = 3): Observable<MovieCommentsResponse> {
    return this.http.get<MovieCommentsResponse>(apiUrl(`/api/movies/${tmdbId}/comments`), {
      params: { offset, limit },
    });
  }

  addComment(tmdbId: number, body: string): Observable<MovieComment> {
    return this.http.post<MovieComment>(apiUrl(`/api/movies/${tmdbId}/comments`), { body });
  }

  deleteComment(commentId: number): Observable<void> {
    return this.http.delete<void>(apiUrl(`/api/comments/${commentId}`));
  }

  toggleCommentLike(commentId: number): Observable<LikeCommentResponse> {
    return this.http.post<LikeCommentResponse>(apiUrl(`/api/comments/${commentId}/like`), {});
  }
}
