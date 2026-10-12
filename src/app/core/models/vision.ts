// Response of `POST /chat/vision` (image recognition). camelCase, unlike the rest of the API.

export interface VisionScrapedMovie {
  title: string;
  originalTitle?: string | null;
  cinemaName: string;
  cinemaLocation: string;
  latitude?: number | null;
  longitude?: number | null;
  bookingUrl: string;
  isUpcoming: boolean;
}

export interface TmdbMatch {
  id: number;
  title: string;
  originalTitle?: string | null;
  releaseDate?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  popularity?: number | null;
  voteAverage?: number | null;
  cinemaShowtimes: VisionScrapedMovie[];
}

export interface MovieCandidate {
  title: string;
  year?: number | null;
  type?: string | null;
  /** 0-1. */
  confidence?: number | null;
  notes?: string | null;
}

export interface CandidateResolution {
  candidate: MovieCandidate;
  matches: TmdbMatch[];
}

export interface VisionSearchResponse {
  notMovieLike: boolean;
  uncertaintyReason?: string | null;
  queryLanguage?: string | null;
  resolutions: CandidateResolution[];
}
