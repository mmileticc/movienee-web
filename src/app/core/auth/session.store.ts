import { Injectable, computed, signal } from '@angular/core';
import { SessionUser } from '../models/user';
import { StorageKeys, storage } from '../util/storage';

/** What the UI needs to show the account before the session is renewed (no credentials). */
export type SignedInUser = Pick<SessionUser, 'id' | 'username' | 'avatarUrl'>;

/** Sessions before the token moved to memory kept it here; it is removed on startup. */
const LEGACY_SESSION_KEY = 'movienee.session.v1';

/**
 * The backend session (the web counterpart of the Android SessionManager).
 *
 * The JWT (`appToken`, valid 24h) lives only in memory, so it never lands in localStorage where any
 * injected script could read it later. After a reload the token is gone and AuthService renews it
 * from the Firebase session on the first backend request. Only the user's id, name and avatar are
 * remembered, so the app knows right away that someone is signed in and can draw the account UI.
 *
 * `isSignedIn()` is the single "signed in" check across the app; the Firebase side is handled by
 * AuthService.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly appToken = signal<string | null>(null);
  private readonly identity = signal<SignedInUser | null>(loadIdentity());

  readonly user = this.identity.asReadonly();
  readonly userId = computed(() => this.identity()?.id ?? null);
  readonly isSignedIn = computed(() => this.identity() !== null);

  constructor() {
    // Signing out (or into another account) in another tab applies here too; this tab's token is
    // dropped and renewed for whoever is signed in now.
    try {
      addEventListener('storage', (event) => {
        if (event.key !== StorageKeys.user) return;
        this.appToken.set(null);
        this.identity.set(parseIdentity(event.newValue));
      });
    } catch {
      // No window (tests without a DOM): nothing to sync.
    }
  }

  token(): string | null {
    return this.appToken();
  }

  /** Stores a new session after sign-in or a token refresh. */
  save(appToken: string, user: SessionUser): void {
    this.appToken.set(appToken);
    this.setIdentity({ id: user.id, username: user.username, avatarUrl: user.avatarUrl });
  }

  /** Updates the cached name/avatar after a profile change, without touching the token. */
  updateIdentity(username: string, avatarUrl: string | null): void {
    const current = this.identity();
    if (current) this.setIdentity({ ...current, username, avatarUrl });
  }

  clear(): void {
    this.appToken.set(null);
    this.identity.set(null);
    storage.remove(StorageKeys.user);
  }

  private setIdentity(user: SignedInUser): void {
    this.identity.set(user);
    storage.setJson(StorageKeys.user, user);
  }
}

function loadIdentity(): SignedInUser | null {
  const legacy = storage.getJson<{ user?: SessionUser }>(LEGACY_SESSION_KEY);
  storage.remove(LEGACY_SESSION_KEY);
  if (legacy?.user?.id) {
    const user = {
      id: legacy.user.id,
      username: legacy.user.username,
      avatarUrl: legacy.user.avatarUrl,
    };
    storage.setJson(StorageKeys.user, user);
    return user;
  }
  return parseIdentity(storage.get(StorageKeys.user));
}

/** Accepts only a well-formed identity; anything else counts as signed out. */
function parseIdentity(raw: string | null): SignedInUser | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SignedInUser> | null;
    if (!value || typeof value.id !== 'string' || !value.id) return null;
    return {
      id: value.id,
      username: typeof value.username === 'string' ? value.username : null,
      avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
    };
  } catch {
    return null;
  }
}
