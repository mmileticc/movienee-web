/**
 * localStorage that never throws: it can be unavailable (private mode, blocked site data), and a
 * missing preference must never break the app.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignored - the value just is not remembered.
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignored.
    }
  },
  getJson<T>(key: string): T | null {
    const raw = storage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
};

/** All storage keys in one place, prefixed so they never clash with other apps on the domain. */
export const StorageKeys = {
  theme: 'movienee.theme',
  language: 'movienee.lang',
  session: 'movienee.session.v1',
  browseViewMode: 'movienee.browseViewMode',
  recentSearches: (scopeId: string) => `movienee.recentSearches.${scopeId}`,
} as const;
