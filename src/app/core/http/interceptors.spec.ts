import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';
import { LanguageService } from '../prefs/language.service';
import { authInterceptor, isBackendRequest, languageInterceptor } from './interceptors';

describe('interceptors', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([languageInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: LanguageService, useValue: { language: () => 'en' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('recognizes backend URLs only', () => {
    expect(isBackendRequest(`${environment.apiBaseUrl}/api/movies/trending`)).toBe(true);
    expect(isBackendRequest('https://image.tmdb.org/t/p/w342/a.jpg')).toBe(false);
    expect(isBackendRequest('i18n/sr.json')).toBe(false);
  });

  it('adds Accept-Language and the token to backend requests', () => {
    TestBed.inject(SessionStore).save('jwt-123', {
      id: 'u1',
      firebaseUid: 'f1',
      username: 'pera',
      email: null,
      avatarUrl: null,
    });
    http.get(`${environment.apiBaseUrl}/api/users/u1`).subscribe();

    const req = controller.expectOne(`${environment.apiBaseUrl}/api/users/u1`);
    expect(req.request.headers.get('Accept-Language')).toBe('en');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
  });

  it('sends no token when signed out and touches no other hosts', () => {
    http.get(`${environment.apiBaseUrl}/api/movies/trending`).subscribe();
    http.get('i18n/sr.json').subscribe();

    const backend = controller.expectOne(`${environment.apiBaseUrl}/api/movies/trending`);
    expect(backend.request.headers.has('Authorization')).toBe(false);
    backend.flush({});

    const other = controller.expectOne('i18n/sr.json');
    expect(other.request.headers.has('Accept-Language')).toBe(false);
    other.flush({});
  });
});
