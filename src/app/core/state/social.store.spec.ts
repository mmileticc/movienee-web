import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';
import { SocialStore } from './social.store';

const BASE = `${environment.apiBaseUrl}/api/users/u1`;
const USER = { id: 'u1', firebaseUid: 'f1', username: 'pera', email: null, avatarUrl: null };

describe('SocialStore', () => {
  let store: SocialStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(SessionStore).save('token', USER);
    store = TestBed.inject(SocialStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The badge polling requests are not part of these tests.
    http.match(() => true);
    http.verify();
  });

  it('finishes the Friends load even when load() runs before the store effect', () => {
    store.load();
    TestBed.tick();
    http.expectOne(`${BASE}/friends`).flush({ friends: [] });
    http.match(`${BASE}/friends/pending`).forEach((r) => r.flush({ requests: [] }));
    http.expectOne(`${BASE}/friends/pending/sent`).flush({ requests: [] });
    http.expectOne(`${BASE}/friends/activity`).flush({ activities: [] });
    expect(store.friends()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('ignores a second action for the same user while the first is in flight', async () => {
    TestBed.tick();
    const user = { id: 'u2', username: 'ana' };
    const first = store.sendRequest(user);
    const second = await store.cancelRequest('u2');
    expect(second).toBe(false);

    http.expectOne(`${BASE}/friends/u2`).flush(null);
    expect(await first).toBe(true);
    expect(store.sent().map((r) => r.id)).toEqual(['u2']);
    expect(store.statusOf({ id: 'u2', status: 'NONE' })).toBe('PENDING_SENT');
  });

  it('trusts the server status for users not touched in this session', () => {
    expect(store.statusOf({ id: 'u3', status: 'ACCEPTED' })).toBe('ACCEPTED');
  });
});
