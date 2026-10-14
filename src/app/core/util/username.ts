/** Same rule as USERNAME_REGEX on the backend (db/UsersTable.kt) and the Android app. */
const USERNAME_REGEX = /^[A-Za-z0-9_.]{3,30}$/;

export type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars';

/** Why a username is invalid (shown under the field), or null when it is valid. */
export function validateUsername(username: string): UsernameProblem | null {
  if (USERNAME_REGEX.test(username)) return null;
  if (username.length < 3) return 'too_short';
  if (username.length > 30) return 'too_long';
  return 'invalid_chars';
}

/**
 * Turns a raw name (usually the Google display name, e.g. "Miloš Miletić") into a valid default
 * username ("milos_miletic"): lowercase, spaces -> underscores, Serbian Latin letters without
 * diacritics. Same algorithm as `sanitizeUsername` on the backend and in the Android app; idempotent
 * for names that are already valid.
 */
export function sanitizeUsername(raw: string): string {
  let s = raw
    .trim()
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '');
  if (s.length > 30) s = s.slice(0, 30).replace(/[_.]+$/, '');
  return s;
}
