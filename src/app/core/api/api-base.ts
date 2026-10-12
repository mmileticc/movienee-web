import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';

/** Full backend URL for an API path (`/api/...`). */
export function apiUrl(path: string): string {
  return `${environment.apiBaseUrl}${path}`;
}

/**
 * Base for APIs under `/api/users/{me}/...`: resolves the signed-in user's id. Callers check
 * `SessionStore.isSignedIn()` first (guards / sign-in dialog); reaching this without a session is a bug.
 */
export abstract class UserScopedApi {
  private readonly session = inject(SessionStore);

  protected me(path = ''): string {
    const userId = this.session.userId();
    if (!userId) throw new Error('Not signed in');
    return apiUrl(`/api/users/${encodeURIComponent(userId)}${path}`);
  }
}
