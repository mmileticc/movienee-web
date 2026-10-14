import { describe, expect, it } from 'vitest';
import { sanitizeUsername, validateUsername } from './username';

describe('username', () => {
  it('validates like the backend', () => {
    expect(validateUsername('pera_peric.1')).toBeNull();
    expect(validateUsername('ab')).toBe('too_short');
    expect(validateUsername('a'.repeat(31))).toBe('too_long');
    expect(validateUsername('Miloš Miletić')).toBe('invalid_chars');
  });

  it('turns a Google display name into a valid username', () => {
    expect(sanitizeUsername('Miloš Miletić')).toBe('milos_miletic');
    expect(sanitizeUsername('Đorđe  Đokić')).toBe('djordje_djokic');
    expect(sanitizeUsername('  __Ana.__ ')).toBe('ana');
  });

  it('keeps names that are already valid', () => {
    expect(sanitizeUsername('milinko_m')).toBe('milinko_m');
  });
});
