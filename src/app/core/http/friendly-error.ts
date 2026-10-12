import { HttpErrorResponse } from '@angular/common/http';

/** A user-facing error: either a translation key or a message the backend already localized. */
export interface FriendlyError {
  key?: string;
  message?: string;
  /** A temporary problem that is not the user's fault (e.g. Gemini overloaded) - shown calmly. */
  soft: boolean;
}

/**
 * Turns any error into something safe to show (the web counterpart of Android's
 * util/FriendlyError.kt). Raw technical text never reaches the UI:
 * - no connection / CORS / timeout -> `error_network`;
 * - 401/403 -> `error_forbidden`, 404 -> `error_not_found`, 429 -> `error_too_many_requests`;
 * - 503 -> the backend's message as a soft error (e.g. Gemini overload);
 * - other 4xx -> the backend's `{ error }` message (already localized via Accept-Language);
 * - 5xx and anything else -> `error_server` / the caller's fallback key.
 */
export function friendlyError(error: unknown, fallbackKey: string): FriendlyError {
  if (!(error instanceof HttpErrorResponse)) return { key: fallbackKey, soft: false };

  const serverMessage =
    typeof error.error?.error === 'string' ? (error.error.error as string) : undefined;
  switch (true) {
    case error.status === 0:
      return { key: 'error_network', soft: false };
    case error.status === 401 || error.status === 403:
      return { key: 'error_forbidden', soft: false };
    case error.status === 404:
      return { key: 'error_not_found', soft: false };
    case error.status === 429:
      return { key: 'error_too_many_requests', soft: false };
    case error.status === 503:
      return serverMessage
        ? { message: serverMessage, soft: true }
        : { key: 'error_server', soft: true };
    case error.status >= 500:
      return { key: 'error_server', soft: false };
    case error.status >= 400 && !!serverMessage:
      return { message: serverMessage, soft: false };
    default:
      return { key: fallbackKey, soft: false };
  }
}
