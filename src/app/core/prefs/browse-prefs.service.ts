import { Injectable, signal } from '@angular/core';
import { StorageKeys, storage } from '../util/storage';

export type BrowseViewMode = 'grid' | 'list';

/** Grid/list choice on the "See all" screens, shared by both and remembered (BrowsePreferences.kt). */
@Injectable({ providedIn: 'root' })
export class BrowsePrefsService {
  readonly viewMode = signal<BrowseViewMode>(
    storage.get(StorageKeys.browseViewMode) === 'list' ? 'list' : 'grid',
  );

  toggle(): void {
    const next: BrowseViewMode = this.viewMode() === 'grid' ? 'list' : 'grid';
    this.viewMode.set(next);
    storage.set(StorageKeys.browseViewMode, next);
  }
}
