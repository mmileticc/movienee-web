import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { StorageKeys, storage } from '../util/storage';

export type AppLanguage = 'sr' | 'en';
export type LanguageOption = 'system' | AppLanguage;

// Browser languages that map to Serbian (same rule as the Android app's AppLocale).
const SERBIAN_FAMILY = ['sr', 'hr', 'bs', 'me', 'cnr'];

/**
 * The app language: "system" (follows the browser; Serbian/Croatian/Bosnian/Montenegrin -> Serbian,
 * anything else -> English) or an explicit choice. Drives Transloco, `<html lang>` and the
 * Accept-Language header sent to the backend.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly option = signal<LanguageOption>(readOption());

  /** The resolved language currently in use. */
  readonly language = computed<AppLanguage>(() => {
    const option = this.option();
    return option === 'system' ? systemLanguage() : option;
  });

  constructor() {
    effect(() => {
      const lang = this.language();
      this.transloco.setActiveLang(lang);
      this.document.documentElement.lang = lang;
    });
  }

  setOption(option: LanguageOption): void {
    this.option.set(option);
    storage.set(StorageKeys.language, option);
  }

  /** Switches between Serbian and English (used by the quick toggle in the top bar). */
  toggle(): void {
    this.setOption(this.language() === 'sr' ? 'en' : 'sr');
  }
}

function readOption(): LanguageOption {
  const stored = storage.get(StorageKeys.language);
  return stored === 'sr' || stored === 'en' ? stored : 'system';
}

function systemLanguage(): AppLanguage {
  const languages =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  const primary = (languages[0] ?? 'en').toLowerCase().split('-')[0];
  return SERBIAN_FAMILY.includes(primary) ? 'sr' : 'en';
}
