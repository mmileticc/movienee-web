import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { friendlyError } from './friendly-error';

const httpError = (status: number, error: unknown = null) =>
  new HttpErrorResponse({ status, error });

describe('friendlyError', () => {
  it('maps connection failures to the network message', () => {
    expect(friendlyError(httpError(0), 'error_search')).toEqual({
      key: 'error_network',
      soft: false,
    });
  });

  it('maps known status codes to their messages', () => {
    expect(friendlyError(httpError(403), 'x').key).toBe('error_forbidden');
    expect(friendlyError(httpError(404), 'x').key).toBe('error_not_found');
    expect(friendlyError(httpError(429), 'x').key).toBe('error_too_many_requests');
    expect(friendlyError(httpError(500), 'x').key).toBe('error_server');
  });

  it('shows the backend message for other client errors', () => {
    expect(friendlyError(httpError(400, { error: 'Username is already taken' }), 'x')).toEqual({
      message: 'Username is already taken',
      soft: false,
    });
  });

  it('marks 503 as a soft error', () => {
    expect(friendlyError(httpError(503, { error: 'Gemini is busy' }), 'x')).toEqual({
      message: 'Gemini is busy',
      soft: true,
    });
  });

  it('never shows raw text of unexpected errors', () => {
    expect(friendlyError(new TypeError('x is undefined'), 'error_search')).toEqual({
      key: 'error_search',
      soft: false,
    });
  });
});
