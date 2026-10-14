import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService, SessionExpiredError } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { LanguageService } from '../prefs/language.service';
import { authInterceptor, languageInterceptor, refreshInterceptor } from './interceptors';

const API = `${environment.apiBaseUrl}/api/users/u1/watchlist`;
const USER = { id: 'u1', firebaseUid: 'f1', username: 'pera', email: null, avatarUrl: null };

describe('refreshInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let session: SessionStore;
  const auth = { refreshSession: vi.fn(), restoreSession: vi.fn(), signOut: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    auth.refreshSession.mockReset();
    auth.restoreSession.mockReset();
    auth.signOut.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([languageInterceptor, refreshInterceptor, authInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: LanguageService, useValue: { language: () => 'sr' } },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.save('old-token', USER);
  });

  afterEach(() => controller.verify());

  it('renews the token on 401 and retries with the new one', async () => {
    auth.refreshSession.mockImplementation(async () => {
      session.save('new-token', USER);
      return 'new-token';
    });
    const result = new Promise((resolve) => http.get(API).subscribe(resolve));

    controller.expectOne(API).flush(null, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    const retry = controller.expectOne(API);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ items: [] });

    await expect(result).resolves.toEqual({ items: [] });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when renewing fails temporarily', async () => {
    auth.refreshSession.mockRejectedValue(new Error('network down'));
    const failed = new Promise((resolve) => http.get(API).subscribe({ error: resolve }));

    controller.expectOne(API).flush(null, { status: 401, statusText: 'Unauthorized' });
    const error = (await failed) as { status: number };

    expect(error.status).toBe(401);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out and passes the 401 on when the session really expired', async () => {
    auth.refreshSession.mockRejectedValue(new SessionExpiredError());
    const failed = new Promise((resolve) => http.get(API).subscribe({ error: resolve }));

    controller.expectOne(API).flush(null, { status: 401, statusText: 'Unauthorized' });
    const error = (await failed) as { status: number };

    expect(error.status).toBe(401);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('does not try to renew for signed-out visitors or other errors', async () => {
    const failed = new Promise((resolve) => http.get(API).subscribe({ error: resolve }));
    controller.expectOne(API).flush(null, { status: 500, statusText: 'Server Error' });
    await failed;

    session.clear();
    const guest = new Promise((resolve) => http.get(API).subscribe({ error: resolve }));
    controller.expectOne(API).flush(null, { status: 401, statusText: 'Unauthorized' });
    await guest;

    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('never writes the token to localStorage', () => {
    expect(JSON.stringify({ ...localStorage })).not.toContain('old-token');
    expect(localStorage.getItem('movienee.user.v1')).toContain('u1');
  });
});

describe('authInterceptor after a page load', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const auth = { refreshSession: vi.fn(), restoreSession: vi.fn(), signOut: vi.fn() };

  function setUp(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    auth.restoreSession.mockReset();
  });

  afterEach(() => controller.verify());

  it('renews the token once for parallel requests before sending them', async () => {
    localStorage.setItem('movienee.user.v1', JSON.stringify({ id: 'u1' }));
    let finish!: (token: string) => void;
    auth.restoreSession.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    setUp();
    expect(TestBed.inject(SessionStore).isSignedIn()).toBe(true);

    http.get(API).subscribe();
    http.get(API).subscribe();
    controller.expectNone(API);
    finish('fresh');
    await new Promise((r) => setTimeout(r));

    const requests = controller.match(API);
    expect(requests.map((r) => r.request.headers.get('Authorization'))).toEqual([
      'Bearer fresh',
      'Bearer fresh',
    ]);
    requests.forEach((r) => r.flush({}));
  });

  it('sends the request without a token when renewing is not possible', async () => {
    localStorage.setItem('movienee.user.v1', JSON.stringify({ id: 'u1' }));
    auth.restoreSession.mockResolvedValue(null);
    setUp();

    http.get(`${environment.apiBaseUrl}/api/movies/trending`).subscribe();
    await new Promise((r) => setTimeout(r));

    const req = controller.expectOne(`${environment.apiBaseUrl}/api/movies/trending`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('moves an old stored session to the identity only, dropping its token', () => {
    localStorage.setItem(
      'movienee.session.v1',
      JSON.stringify({ appToken: 'leaked', user: { ...USER, email: 'a@b.c' } }),
    );
    setUp();

    const session = TestBed.inject(SessionStore);
    expect(session.userId()).toBe('u1');
    expect(session.token()).toBeNull();
    expect(localStorage.getItem('movienee.session.v1')).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/leaked|a@b\.c/);
  });

  it('ignores a malformed stored identity', () => {
    localStorage.setItem('movienee.user.v1', '{"id": 42}');
    setUp();
    expect(TestBed.inject(SessionStore).isSignedIn()).toBe(false);
  });
});
