import { Injectable, computed, signal } from '@angular/core';
import { SessionUser } from '../models/user';
import { StorageKeys, storage } from '../util/storage';

interface StoredSession {
  appToken: string;
  user: SessionUser;
}

/**
 * The backend session: the JWT (`appToken`, valid 24h) and the signed-in user, kept in localStorage
 * (the web counterpart of the Android SessionManager). `isSignedIn()` is the single "signed in"
 * check across the app; the Firebase side is handled by AuthService.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly session = signal<StoredSession | null>(
    storage.getJson<StoredSession>(StorageKeys.session),
  );

  readonly user = computed(() => this.session()?.user ?? null);
  readonly userId = computed(() => this.session()?.user.id ?? null);
  readonly isSignedIn = computed(() => this.session() !== null);

  token(): string | null {
    return this.session()?.appToken ?? null;
  }

  /** Stores a new session after sign-in or a token refresh. */
  save(appToken: string, user: SessionUser): void {
    const value = { appToken, user };
    this.session.set(value);
    storage.setJson(StorageKeys.session, value);
  }

  /** Updates the cached name/avatar after a profile change, without touching the token. */
  updateIdentity(username: string, avatarUrl: string | null): void {
    const current = this.session();
    if (!current) return;
    this.save(current.appToken, { ...current.user, username, avatarUrl });
  }

  clear(): void {
    this.session.set(null);
    storage.remove(StorageKeys.session);
  }
}
