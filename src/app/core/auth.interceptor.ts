import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.aws.apiUrl)) return next(request);
  const auth = inject(AuthService);
  const token = auth.idToken();
  const authenticatedRequest = token ? request.clone({ setHeaders: { Authorization: token } }) : request;
  return next(authenticatedRequest).pipe(
    catchError(error => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token) return throwError(() => error);
      return from(auth.refreshSession()).pipe(
        switchMap(refreshed => {
          if (!refreshed) return throwError(() => error);
          return next(request.clone({ setHeaders: { Authorization: auth.idToken() } }));
        }),
      );
    }),
  );
};
