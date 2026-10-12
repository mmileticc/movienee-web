import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
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
