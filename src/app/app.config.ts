import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor, languageInterceptor, refreshInterceptor } from './core/http/interceptors';
import { provideAppTransloco } from './core/i18n/transloco.config';
import { LanguageService } from './core/prefs/language.service';
import { ThemeService } from './core/prefs/theme.service';
import { PwaService } from './core/pwa/pwa.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([languageInterceptor, refreshInterceptor, authInterceptor])),
    provideAppTransloco(),
    // Offline-capable, installable app; only in production builds (see ngsw-config.json).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Resolve the language and theme, and load the translations, before the first render, so the
    // app never flashes untranslated keys.
    provideAppInitializer(() => {
      inject(ThemeService);
      // Listens for new versions and the install prompt from the very first moment.
      inject(PwaService);
      const language = inject(LanguageService).language();
      return firstValueFrom(inject(TranslocoService).load(language));
    }),
  ],
};
