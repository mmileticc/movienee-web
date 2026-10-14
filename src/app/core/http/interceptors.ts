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

/** The sign-in exchange itself must never wait for (or trigger) a session renewal. */
function isAuthExchange(url: string): boolean {
  return url.includes('/api/auth/firebase');
}

/**
 * Adds `Authorization: Bearer <appToken>` to backend requests when a session exists. The token is
 * kept only in memory, so after a page load the first backend request of a signed-in user waits for
 * it to be renewed from the Firebase session (one shared renewal for all requests). If that is not
 * possible right now the request goes out without a token; a session that really ended signs out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendRequest(req.url)) return next(req);
  const session = inject(SessionStore);
  const send = (token: string | null) =>
    next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

  const token = session.token();
  if (token || !session.isSignedIn() || isAuthExchange(req.url)) return send(token);
  return from(inject(AuthService).restoreSession()).pipe(switchMap(send));
};

/**
 * On a 401 from the backend, renews the JWT once (Firebase ID token -> new backend JWT) and retries
 * the request - the web counterpart of the Android TokenAuthenticator. Placed before
 * `authInterceptor`, so the retry passes through it again and gets the new token. If the user is
 * really signed out the session is cleared; a temporary failure (no connection, backend restarting)
 * keeps the session. Either way the original 401 is passed on.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isBackendRequest(req.url) || isAuthExchange(req.url)) return next(req);
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
