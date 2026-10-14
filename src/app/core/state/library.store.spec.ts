import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';
import { LibraryStore } from './library.store';

const BASE = `${environment.apiBaseUrl}/api/users/u1`;
const USER = { id: 'u1', firebaseUid: 'f1', username: 'pera', email: null, avatarUrl: null };
const item = (id: number) => ({ tmdb_id: id, title: `Movie ${id}`, added_at: id, priority: 0 });

const flushEffects = () => TestBed.tick();

describe('LibraryStore', () => {
  let store: LibraryStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(SessionStore).save('token', USER);
    store = TestBed.inject(LibraryStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(watchlist = [item(1)]) {
    http.expectOne(`${BASE}/watchlist`).flush({ items: watchlist });
    http.expectOne(`${BASE}/history`).flush({ items: [] });
  }

  it('finishes the first load even when ensureLoaded runs before the store effect', () => {
    store.ensureLoaded();
    flushEffects();
    load();
    expect(store.watchlist()?.map((i) => i.tmdb_id)).toEqual([1]);
    expect(store.loading()).toBe(false);
  });

  it('reverts only the failed movie, keeping other changes', async () => {
    store.ensureLoaded();
    flushEffects();
    load([]);

    const a = store.toggleWatchlist({ id: 10, title: 'A' });
    const b = store.toggleWatchlist({ id: 20, title: 'B' });
    const requests = http.match(`${BASE}/watchlist`);
    expect(requests.length).toBe(2);
    requests[1].flush(item(20));
    requests[0].flush({ error: 'x' }, { status: 500, statusText: 'Server Error' });

    expect(await a).toBe(false);
    expect(await b).toBe(true);
    expect(store.watchlist()?.map((i) => i.tmdb_id)).toEqual([20]);
  });

  it('sends one request per movie at a time and uses PUT once the row exists', async () => {
    store.ensureLoaded();
    flushEffects();
    load([]);

    const watched = store.toggleWatched({ id: 5, title: 'Five' });
    const rated = store.setRating({ id: 5, title: 'Five' }, 8);
    // Only the POST is in flight; the rating waits for it instead of cancelling it.
    const post = http.expectOne(`${BASE}/history`);
    expect(post.request.method).toBe('POST');
    post.flush({ tmdb_id: 5, title: 'Five', user_rating: 0, watched_at: 1, duration: 0 });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));

    const put = http.expectOne(`${BASE}/history/5`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ rating: 8 });
    put.flush({ tmdb_id: 5, title: 'Five', user_rating: 8, watched_at: 1, duration: 0 });

    expect(await watched).toBe(true);
    expect(await rated).toBe(true);
    expect(store.historyItem(5)?.user_rating).toBe(8);
  });
});
