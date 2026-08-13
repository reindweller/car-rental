import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() || await auth.refreshSession()) return true;
  return inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.currentUser()?.role === 'Administrator' ? true : inject(Router).createUrlTree(['/dashboard']);
};
