import { describe, expect, it } from 'vitest';
import { Showtime } from '../models/movie';
import { dayLabel, hallLabel, safeLink, showtimeDays, timeOf, timesOnDay } from './showtimes';

const cinema = (times: string[]): Showtime => ({
  cinema_name: 'Arena Cineplex',
  cinema_location: 'Arena',
  booking_url: 'https://example.com',
  is_upcoming: false,
  times: times.map((starts_at) => ({ starts_at })),
});

const t = (key: string, params?: { p1: string }) => (params ? `${key}:${params.p1}` : key);

describe('showtimes', () => {
  it('collects the days with screenings in order', () => {
    const cinemas = [
      cinema(['2026-10-16T19:00', '2026-10-15T21:00']),
      cinema(['2026-10-15T18:00']),
      cinema([]),
    ];
    expect(showtimeDays(cinemas)).toEqual(['2026-10-15', '2026-10-16']);
    expect(timesOnDay(cinemas[0], '2026-10-15').map(timeOf)).toEqual(['21:00']);
    expect(timesOnDay(cinemas[2], '2026-10-15')).toEqual([]);
  });

  it('names today and tomorrow, then weekday and date', () => {
    expect(dayLabel('2026-10-15', 'sr', t, '2026-10-15')).toBe('showtimes_today');
    expect(dayLabel('2026-10-16', 'sr', t, '2026-10-15')).toBe('showtimes_tomorrow');
    // 19 Oct 2026 is a Monday.
    expect(dayLabel('2026-10-19', 'en', t, '2026-10-15')).toMatch(/Mon/);
    // Tomorrow across the end of a month.
    expect(dayLabel('2026-11-01', 'sr', t, '2026-10-31')).toBe('showtimes_tomorrow');
  });

  it('labels bare hall numbers and keeps named halls', () => {
    expect(hallLabel('2', t)).toBe('showtimes_hall_number:2');
    expect(hallLabel('Marilyn Monroe', t)).toBe('Marilyn Monroe');
    expect(hallLabel('  ', t)).toBeNull();
  });

  it('accepts only web links', () => {
    expect(safeLink('https://cineplexx.rs/purchase/wizard/1-2')).toBe(
      'https://cineplexx.rs/purchase/wizard/1-2',
    );
    expect(safeLink('http://ulaznice.tuck.rs/x')).toBe('http://ulaznice.tuck.rs/x');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});
