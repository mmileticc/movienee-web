import { AppLanguage } from '../prefs/language.service';

const LOCALES: Record<AppLanguage, string> = { sr: 'sr-Latn-RS', en: 'en-GB' };

/** "8,4" / "8.4" - one decimal, localized. */
export function formatRating(value: number | null | undefined, lang: AppLanguage): string | null {
  if (value == null || value <= 0) return null;
  return new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** "12. oktobar 2026." / "12 October 2026"; returns the input if it is not a valid date. */
export function formatDate(iso: string | null | undefined, lang: AppLanguage): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** "1,2 km" / "1.2 km". */
export function formatDistance(km: number, lang: AppLanguage): string {
  return `${new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 1 }).format(km)} km`;
}

/** Whole years between `from` and `to` (or today); null for invalid dates. */
export function yearsBetween(from: string, to?: string | null): number | null {
  const start = new Date(`${from}T00:00:00`);
  const end = to ? new Date(`${to}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  let years = end.getFullYear() - start.getFullYear();
  const beforeBirthday =
    end.getMonth() < start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() < start.getDate());
  if (beforeBirthday) years--;
  return years;
}
