import { Showtime, ShowtimeSlot } from '../models/movie';
import { AppLanguage } from '../prefs/language.service';

const LOCALES: Record<AppLanguage, string> = { sr: 'sr-Latn-RS', en: 'en-GB' };
const CINEMA_ZONE = 'Europe/Belgrade';

/** "2026-10-15" for a moment, as a calendar day in Belgrade (where the times are local). */
export function cinemaDay(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: CINEMA_ZONE }).format(date);
}

/** The days that have at least one screening, in order ("2026-10-15", ...). */
export function showtimeDays(cinemas: readonly Showtime[]): string[] {
  const days = new Set(
    cinemas.flatMap((c) => (c.times ?? []).map((t) => t.starts_at.slice(0, 10))),
  );
  return [...days].sort();
}

/** The screenings of one cinema on one day. */
export function timesOnDay(cinema: Showtime, day: string | null): ShowtimeSlot[] {
  return day ? (cinema.times ?? []).filter((t) => t.starts_at.startsWith(day)) : [];
}

/** "19:00" from "2026-10-15T19:00". */
export function timeOf(slot: ShowtimeSlot): string {
  return slot.starts_at.slice(11, 16);
}

/**
 * Label of a day chip: "today" / "tomorrow" keys for the first two, otherwise a short weekday and
 * date ("pon 19.10." / "Mon 19/10").
 */
export function dayLabel(
  day: string,
  lang: AppLanguage,
  translate: (key: string) => string,
  today: string = cinemaDay(),
): string {
  const tomorrow = nextDay(today);
  if (day === today) return translate('showtimes_today');
  if (day === tomorrow) return translate('showtimes_tomorrow');
  const [y, m, d] = day.split('-').map(Number);
  // Noon UTC, so the weekday is right in every time zone.
  return new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** "Sala 2" for a bare number (Arena, Roda), otherwise the cinema's own name ("Sala 6", "Marilyn Monroe"). */
export function hallLabel(
  hall: string | null | undefined,
  translate: (key: string, params: { p1: string }) => string,
): string | null {
  const text = hall?.trim();
  if (!text) return null;
  return /^\d+$/.test(text) ? translate('showtimes_hall_number', { p1: text }) : text;
}

/** Only real web links (the data comes from scraped sites), otherwise null. */
export function safeLink(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
