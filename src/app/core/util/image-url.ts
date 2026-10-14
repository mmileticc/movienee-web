import { environment } from '../../../environments/environment';

/** TMDB image sizes used by the app (poster widths and backdrop widths). */
export type TmdbImageSize =
  'w92' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

/** `srcset` from TMDB widths, e.g. `w185 185w, w342 342w`; null when there is no path. */
export function tmdbSrcset(
  path: string | null | undefined,
  sizes: Exclude<TmdbImageSize, 'original'>[],
): string | null {
  return path ? sizes.map((size) => `${tmdbImage(path, size)} ${size.slice(1)}w`).join(', ') : null;
}

/** Full TMDB image URL for a poster/backdrop/profile path, or null when there is no path. */
export function tmdbImage(
  path: string | null | undefined,
  size: TmdbImageSize = 'w342',
): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/**
 * Avatar URL as the backend sends it: an absolute URL, a `data:` URI, or a backend path
 * (`/api/users/{id}/avatar?v=...`) when the server has no PUBLIC_BASE_URL - completed here.
 */
export function avatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/')) return `${environment.apiBaseUrl}${value}`;
  return value;
}

/** "2026" from "2026-10-09", or null. */
export function releaseYear(date: string | null | undefined): string | null {
  return date && date.length >= 4 ? date.slice(0, 4) : null;
}
