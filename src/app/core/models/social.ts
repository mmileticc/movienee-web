// Friends, activity, Movie Night, sharing and notifications (same contract as Android UserModels.kt).
import { Genre } from './movie';

export type FriendshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'ACCEPTED';

export interface FriendInfo {
  friend_id: string;
  username: string;
  avatar?: string | null;
  /** Taste match, 0-100. */
  match_score: number;
  common_genres: string[];
}

export interface FriendsResponse {
  friends: FriendInfo[];
}

export interface UserSearchResult {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  status: FriendshipStatus;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
}

/** A pending friend request (incoming or sent). */
export interface PendingRequest {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
}

export interface PendingRequestsResponse {
  requests: PendingRequest[];
}

export type FriendAction = 'add' | 'accept' | 'reject';

export interface FriendProfileMovie {
  tmdb_id: number;
  title: string;
  poster_path?: string | null;
  rating?: number | null;
  review?: string | null;
  watched_at: number;
}

/**
 * Another user's profile. Before the friendship is accepted the backend returns a limited preview:
 * `watched_movies` is empty, `email` is null and `common_genres` is filled instead.
 */
export interface FriendProfileResponse {
  id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  watched_movies: FriendProfileMovie[];
  email?: string | null;
  friendship_status?: FriendshipStatus | null;
  common_genres?: string[] | null;
}

/** A friend who watched the movie ("friends watched" badge on the detail page). */
export interface FriendWatched {
  friend_id: string;
  friend_name: string;
  rating?: number | null;
  review?: string | null;
}

export interface FriendsWatchedResponse {
  friends: FriendWatched[];
}

export type ActivityAction = 'rated' | 'watched' | 'added_to_watchlist';

export interface FriendActivity {
  activity_id: string;
  friend_id: string;
  friend_name: string;
  action: ActivityAction | string;
  tmdb_id: number;
  movie_title: string;
  poster_path?: string | null;
  metadata: { rating?: number | null; review?: string | null; watched_at?: number | null };
  timestamp: number;
}

export interface FriendActivityResponse {
  activities: FriendActivity[];
}

export interface MovieSuggestion {
  tmdb_id: number;
  title: string;
  poster_path?: string | null;
  match_reason: string;
  scores: { your_match: number; their_match: number; combined_score: number };
  release_date?: string | null;
  vote_average?: number | null;
  genre_ids?: number[] | null;
}

export interface MovieNightResponse {
  suggestions: MovieSuggestion[];
  has_more: boolean;
  friend_username?: string | null;
  shared_genres?: Genre[] | null;
  match_score?: number | null;
}

/** Body of `POST /share` (camelCase on the backend). */
export interface ShareMovieRequest {
  friendId: string;
  tmdbId: number;
  note?: string | null;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'MOVIE_SHARED'
  | 'COMMENT_LIKED'
  | 'WATCHLIST_IN_CINEMA'
  | string;

/** One stored notification; `data` holds the same values as the push message. */
export interface NotificationItem {
  id: number;
  type?: NotificationType | null;
  content: string;
  data?: Record<string, string> | null;
  isRead: boolean;
  createdAt?: number | null;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
}

/** Who did something in the feed. */
export interface FeedFriend {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
}

export type FeedItemType = 'rated' | 'watched' | 'commented';

/** One feed card; `timestamp` is epoch ms. */
export interface FeedItem {
  id: string;
  type: FeedItemType | string;
  friend: FeedFriend;
  tmdb_id: number;
  movie_title: string;
  poster_path?: string | null;
  rating?: number | null;
  text?: string | null;
  timestamp: number;
}

/** A movie the user and these friends all want to watch (only movies on the user's own list). */
export interface SharedWish {
  tmdb_id: number;
  movie_title: string;
  poster_path?: string | null;
  friends: FeedFriend[];
  cinema_count: number;
}

export interface FeedResponse {
  items: FeedItem[];
  has_more: boolean;
  shared_wishes?: SharedWish[];
}

/** The user's own invite link. */
export interface MyInvite {
  code: string;
  url: string;
}

/** Who sent an invite link (public: name and avatar only). */
export interface Inviter {
  inviter_id: string;
  username?: string | null;
  avatar_url?: string | null;
}

export interface InviteAccepted {
  friend_id: string;
  already_friends: boolean;
}
