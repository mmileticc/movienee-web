// Movie data returned by the backend (`/api/movies`, `/api/people`). Field names are the JSON names
// (snake_case), the same contract as the Android app's MovieModels.kt.

export interface Genre {
  id: number;
  name: string;
}

/** A movie in a list (search, trending, featured). */
export interface MovieSummary {
  id: number;
  title: string;
  release_date?: string | null;
  poster_path?: string | null;
  vote_average: number;
  overview?: string | null;
  genre_ids?: number[] | null;
}

export interface MovieListResponse {
  results: MovieSummary[];
}

export interface GenreListResponse {
  genres: Genre[];
}

export interface CastMember {
  id: number;
  name: string;
  character?: string | null;
  profile_path?: string | null;
}

/** A YouTube trailer or teaser; `key` is the YouTube video id. */
export interface MovieVideo {
  key: string;
  name?: string | null;
  type?: string | null;
}

/** A cinema showing the movie. `distance_km` is set only when the request carried a location. */
export interface Showtime {
  cinema_name: string;
  cinema_location: string;
  booking_url: string;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  is_upcoming: boolean;
  /** Screenings of the next days at this cinema, earliest first; missing from older backends. */
  times?: ShowtimeSlot[];
}

/** One screening. `starts_at` is the local time in Belgrade, e.g. "2026-10-15T19:00". */
export interface ShowtimeSlot {
  starts_at: string;
  hall?: string | null;
  format?: string | null;
  /** Ticket page of exactly this screening. */
  booking_url?: string | null;
  price_rsd?: number | null;
}

export interface MovieDetail {
  id: number;
  title: string;
  release_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  vote_average: number;
  runtime: number;
  genres: Genre[];
  cast: CastMember[];
  showtimes: Showtime[];
  imdb_rating?: number | null;
  rotten_tomatoes?: string | null;
  imdb_id?: string | null;
  videos?: MovieVideo[] | null;
  backdrops?: string[] | null;
}

/** A movie in the current cinema programme with the cinemas showing it. */
export interface NowInCinemasMovie {
  id: number;
  title: string;
  poster_path?: string | null;
  vote_average: number;
  cinemas: string[];
  genres?: Genre[] | null;
  release_date?: string | null;
  overview?: string | null;
  runtime?: number | null;
  is_upcoming?: boolean | null;
}

export interface NowInCinemasResponse {
  results: NowInCinemasMovie[];
}

/** One movie of a person's filmography. */
export interface PersonMovieCredit {
  id: number;
  title: string;
  character?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  known_for_department?: string | null;
  movie_credits: PersonMovieCredit[];
}

/** A public comment on a movie. */
export interface MovieComment {
  id: number;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  body: string;
  created_at: number;
  like_count: number;
  liked_by_me: boolean;
  is_friend: boolean;
  is_own: boolean;
}

export interface MovieCommentsResponse {
  comments: MovieComment[];
  has_more: boolean;
}

export interface LikeCommentResponse {
  liked_by_me: boolean;
  like_count: number;
}

/** Error body of every failed backend response (localized via Accept-Language). */
export interface ErrorResponse {
  error: string;
}
