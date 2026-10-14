import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor, languageInterceptor, refreshInterceptor } from './core/http/interceptors';
import { provideAppTransloco } from './core/i18n/transloco.config';
import { LanguageService } from './core/prefs/language.service';
import { ThemeService } from './core/prefs/theme.service';

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
    // Resolve the language and theme, and load the translations, before the first render, so the
    // app never flashes untranslated keys.
    provideAppInitializer(() => {
      inject(ThemeService);
      const language = inject(LanguageService).language();
      return firstValueFrom(inject(TranslocoService).load(language));
    }),
  ],
};
