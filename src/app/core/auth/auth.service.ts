import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Auth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { apiUrl } from '../api/api-base';
import { AuthResponse } from '../models/user';
import { SessionStore } from './session.store';

/**
 * The session cannot be renewed: the user is signed out of Firebase or the backend rejected the
 * Firebase token. Only this means "sign out"; network errors and 5xx are temporary.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

interface FirebaseModules {
  auth: Auth;
  mod: typeof import('firebase/auth');
}

/**
 * Sign-in: Google via Firebase Authentication, then the Firebase ID token is exchanged for the
 * backend's own JWT (`POST /api/auth/firebase`), kept in memory by SessionStore. Same flow as the
 * Android app. After a page load the JWT is renewed from the Firebase session (`restoreSession`).
 *
 * The Firebase SDK is loaded lazily (dynamic import) the first time it is needed, so visitors who
 * never sign in do not download it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private firebase?: Promise<FirebaseModules>;
  private refreshing: Promise<string> | null = null;

  /** Opens the Google popup; falls back to a full-page redirect when the popup is blocked. */
  async signInWithGoogle(): Promise<void> {
    const { auth, mod } = await this.loadFirebase();
    const provider = new mod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await mod.signInWithPopup(auth, provider);
      await this.exchange(await result.user.getIdToken());
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/popup-blocked') {
        await mod.signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  }

  /** Finishes a redirect sign-in started by `signInWithGoogle` (no-op if there was none). */
  async completeRedirectSignIn(): Promise<boolean> {
    const { auth, mod } = await this.loadFirebase();
    const result = await mod.getRedirectResult(auth);
    if (!result) return false;
    await this.exchange(await result.user.getIdToken());
    return true;
  }

  /**
   * Renews the backend JWT (valid 24h) with a fresh Firebase ID token. Parallel callers share one
   * refresh, so several requests failing with 401 at once trigger a single exchange.
   *
   * Throws SessionExpiredError when the user really is signed out; any other error (no connection,
   * backend restarting) is temporary and is rethrown as is, so the caller keeps the session.
   */
  refreshSession(): Promise<string> {
    this.refreshing ??= (async () => {
      const { auth } = await this.loadFirebase();
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new SessionExpiredError();
      try {
        return await this.exchange(await user.getIdToken(true), true);
      } catch (error) {
        const rejected =
          error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
        const firebaseSignedOut =
          /auth\/(user-token-expired|user-disabled|user-not-found|invalid-user-token)/.test(
            String((error as { code?: string }).code ?? ''),
          );
        throw rejected || firebaseSignedOut ? new SessionExpiredError() : error;
      }
    })().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /**
   * The token for a signed-in user whose token is not in memory yet (after a page load): renewed
   * from the Firebase session. Resolves to null when that is not possible right now; a session that
   * really ended signs the user out.
   */
  async restoreSession(): Promise<string | null> {
    try {
      return await this.refreshSession();
    } catch (error) {
      if (error instanceof SessionExpiredError) await this.signOut();
      return null;
    }
  }

  /** Signs out of Firebase and clears the backend session. */
  async signOut(): Promise<void> {
    this.session.clear();
    // Firebase keeps its own session (IndexedDB) across reloads, so it is loaded here even if this
    // page never needed it; otherwise the device would stay signed in to Firebase.
    const { auth, mod } = await this.loadFirebase();
    await mod.signOut(auth);
  }

  /** `renewing`: a renewal that finishes after the user signed out must not sign them back in. */
  private async exchange(idToken: string, renewing = false): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(apiUrl('/api/auth/firebase'), { idToken }),
    );
    if (!response?.appToken) throw new Error('No token in the sign-in response');
    if (renewing && !this.session.isSignedIn()) throw new SessionExpiredError();
    this.session.save(response.appToken, response.user);
    return response.appToken;
  }

  private loadFirebase(): Promise<FirebaseModules> {
    this.firebase ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(
      ([app, mod]) => {
        const firebaseApp = app.getApps()[0] ?? app.initializeApp(environment.firebase);
        return { auth: mod.getAuth(firebaseApp), mod };
      },
    );
    return this.firebase;
  }
}
