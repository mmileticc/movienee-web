import { HttpClient } from '@angular/common/http';
import { Injectable, isDevMode, inject } from '@angular/core';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';

/** Loads `public/i18n/<lang>.json` (generated from the Android strings by tools/convert-android-strings.mjs). */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

export function provideAppTransloco() {
  return provideTransloco({
    config: {
      availableLangs: ['sr', 'en'],
      defaultLang: 'sr',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
      prodMode: !isDevMode(),
    },
    loader: TranslocoHttpLoader,
  });
}
