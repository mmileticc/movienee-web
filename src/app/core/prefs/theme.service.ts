import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { StorageKeys, storage } from '../util/storage';

export type ThemeOption = 'system' | 'dark' | 'light';

/**
 * Dark / light theme. "system" follows prefers-color-scheme; an explicit choice sets
 * `<html data-theme>` (the tokens in styles/_tokens.scss react to it). index.html applies the saved
 * choice before Angular starts, so there is no flash of the wrong theme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly option = signal<ThemeOption>(readOption());

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      const option = this.option();
      if (option === 'system') {
        delete root.dataset['theme'];
      } else {
        root.dataset['theme'] = option;
      }
    });
  }

  setOption(option: ThemeOption): void {
    this.option.set(option);
    if (option === 'system') storage.remove(StorageKeys.theme);
    else storage.set(StorageKeys.theme, option);
  }

  /** Cycles system -> dark -> light -> system (the quick toggle in the top bar). */
  cycle(): void {
    const next: Record<ThemeOption, ThemeOption> = {
      system: 'dark',
      dark: 'light',
      light: 'system',
    };
    this.setOption(next[this.option()]);
  }
}

function readOption(): ThemeOption {
  const stored = storage.get(StorageKeys.theme);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
}
