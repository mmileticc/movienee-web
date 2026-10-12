// Signed-in user data (`/api/users/{userId}/...`), same contract as the Android app's UserModels.kt.
import { Genre } from './movie';

/** User returned by the sign-in exchange (`POST /api/auth/firebase`). */
export interface SessionUser {
  id: string;
  firebaseUid: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthResponse {
  appToken: string;
  user: SessionUser;
}

export interface UserStats {
  movies_watched: number;
  movies_rated: number;
  friend_count: number;
}

export interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  favorite_genres: string[];
  stats: UserStats;
}

/** Body of `PUT /profile`; `avatar` is a data URI only when a new picture was picked. */
export interface UpdateProfileRequest {
  username: string;
  bio?: string | null;
  avatar?: string | null;
}

export interface WatchlistItem {
  tmdb_id: number;
  title: string;
  poster_path?: string | null;
  added_at: number;
  priority: number;
  genres?: Genre[] | null;
  release_year?: number | null;
  vote_average?: number | null;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

/** A watched (and possibly rated) movie. `user_rating` 0 = watched without a rating. */
export interface HistoryItem {
  tmdb_id: number;
  title: string;
  poster_path?: string | null;
  user_rating: number;
  review?: string | null;
  watched_at: number;
  duration: number;
  genres?: Genre[] | null;
  release_year?: number | null;
  vote_average?: number | null;
}

export interface HistoryResponse {
  items: HistoryItem[];
}

/** `rating`/`duration` null = watched without them. */
export interface AddToHistoryRequest {
  tmdbId: number;
  rating?: number | null;
  review?: string | null;
  duration?: number | null;
}

/** null fields keep the existing value. */
export interface UpdateHistoryRequest {
  rating?: number | null;
  review?: string | null;
}

/** Average rating per genre, derived from the user's ratings. */
export interface GenreAffinity {
  genre_id: number;
  genre: string;
  average_rating: number;
  movie_count: number;
}

export interface TasteProfileResponse {
  genres: GenreAffinity[];
}
