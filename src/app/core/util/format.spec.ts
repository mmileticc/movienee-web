import { describe, expect, it } from 'vitest';
import { cinemasSubtitle } from '../../features/browse/browse-movie';
import { formatDistance, formatRating, formatTimeAgo, yearsBetween } from './format';
import { avatarUrl, releaseYear, tmdbImage } from './image-url';
import { environment } from '../../../environments/environment';

describe('format helpers', () => {
  it('formats ratings per language and hides missing ones', () => {
    expect(formatRating(8.44, 'en')).toBe('8.4');
    expect(formatRating(8.44, 'sr')).toBe('8,4');
    expect(formatRating(0, 'en')).toBeNull();
    expect(formatRating(null, 'en')).toBeNull();
  });

  it('formats distances', () => {
    expect(formatDistance(1.234, 'sr')).toBe('1,2 km');
  });

  it('says how long ago something happened, then the date after a week', () => {
    const now = Date.UTC(2026, 9, 15, 12, 0);
    expect(formatTimeAgo(now - 20_000, 'en', now)).toBe('now');
    expect(formatTimeAgo(now - 5 * 60_000, 'en', now)).toMatch(/^5 min\.? ago$/);
    expect(formatTimeAgo(now - 3 * 3_600_000, 'en', now)).toMatch(/^3 hr\.? ago$/);
    expect(formatTimeAgo(now - 86_400_000, 'en', now)).toBe('yesterday');
    expect(formatTimeAgo(now - 10 * 86_400_000, 'en', now)).toMatch(/2026/);
  });

  it('counts whole years', () => {
    expect(yearsBetween('1995-12-27', '2026-10-12')).toBe(30);
    expect(yearsBetween('1995-10-12', '2026-10-12')).toBe(31);
    expect(yearsBetween('not-a-date', '2026-10-12')).toBeNull();
  });
});

describe('image helpers', () => {
  it('builds TMDB URLs only when there is a path', () => {
    expect(tmdbImage('/a.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/a.jpg');
    expect(tmdbImage(null)).toBeNull();
  });

  it('completes backend avatar paths and keeps other URLs', () => {
    expect(avatarUrl('/api/users/1/avatar?v=2')).toBe(
      `${environment.apiBaseUrl}/api/users/1/avatar?v=2`,
    );
    expect(avatarUrl('https://lh3.googleusercontent.com/x')).toBe(
      'https://lh3.googleusercontent.com/x',
    );
    expect(avatarUrl(null)).toBeNull();
  });

  it('extracts the release year', () => {
    expect(releaseYear('2026-12-15')).toBe('2026');
    expect(releaseYear(undefined)).toBeNull();
  });
});

describe('cinemasSubtitle', () => {
  it('shows two cinemas and counts the rest', () => {
    expect(cinemasSubtitle(['A', 'B', 'C', 'D'])).toBe('A, B +2');
    expect(cinemasSubtitle(['A'])).toBe('A');
    expect(cinemasSubtitle([])).toBeNull();
  });
});
