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
  const auth = { refreshSession: vi.fn(), signOut: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    auth.refreshSession.mockReset();
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
});
