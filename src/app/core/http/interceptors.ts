import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, SessionExpiredError } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { LanguageService } from '../prefs/language.service';

/** True for requests to the Movienee backend (not TMDB images, translations or Firebase). */
export function isBackendRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

/** Sends the app language, so the backend localizes its messages (see Localization.kt). */
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendRequest(req.url)) return next(req);
  const language = inject(LanguageService).language();
  return next(req.clone({ setHeaders: { 'Accept-Language': language } }));
};

/** Adds `Authorization: Bearer <appToken>` to backend requests when a session exists. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendRequest(req.url)) return next(req);
  const token = inject(SessionStore).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

/**
 * On a 401 from the backend, renews the JWT once (Firebase ID token -> new backend JWT) and retries
 * the request - the web counterpart of the Android TokenAuthenticator. Placed before
 * `authInterceptor`, so the retry passes through it again and gets the new token. If the user is
 * really signed out the session is cleared; a temporary failure (no connection, backend restarting)
 * keeps the session. Either way the original 401 is passed on.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendRequest(req.url) || req.url.includes('/api/auth/firebase')) return next(req);
  const session = inject(SessionStore);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!unauthorized || !session.isSignedIn()) return throwError(() => error);
      return from(auth.refreshSession()).pipe(
        catchError((refreshError: unknown) => {
          if (refreshError instanceof SessionExpiredError) void auth.signOut();
          return throwError(() => error);
        }),
        switchMap(() => next(req)),
      );
    }),
  );
};
