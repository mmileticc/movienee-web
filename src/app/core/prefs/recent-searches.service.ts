import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { StorageKeys, storage } from '../util/storage';

const MAX_ITEMS = 8;

/**
 * Recent search queries (RecentSearchesStore.kt), most recent first, stored per account ("guest"
 * when signed out) so another account on the same browser never sees someone else's history.
 */
@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  private readonly session = inject(SessionStore);
  private readonly scope = computed(() => this.session.userId() ?? 'guest');
  private readonly version = signal(0);

  /** Re-read whenever the account changes or the list is modified. */
  readonly queries = computed(() => {
    this.version();
    return storage.getJson<string[]>(StorageKeys.recentSearches(this.scope())) ?? [];
  });

  /** Adds the query at the top (removing an earlier duplicate, case-insensitive). */
  add(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    const rest = this.queries().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    this.write([trimmed, ...rest].slice(0, MAX_ITEMS));
  }

  remove(query: string): void {
    this.write(this.queries().filter((q) => q !== query));
  }

  clear(): void {
    this.write([]);
  }

  private write(queries: string[]): void {
    storage.setJson(StorageKeys.recentSearches(this.scope()), queries);
    this.version.update((v) => v + 1);
  }
}
