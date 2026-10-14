import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session.store';

/** Screens that need an account: signed-out visitors go to Sign in and come back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).isSignedIn()) return true;
  return inject(Router).createUrlTree(['/sign-in'], { queryParams: { next: state.url } });
};
