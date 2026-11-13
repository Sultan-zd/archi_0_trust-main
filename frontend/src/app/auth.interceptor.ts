import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { CONFIG } from './config';

/** Ajoute le jeton Keycloak (Bearer) aux appels vers le backend Spring Boot, et uniquement vers lui. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(CONFIG.apiUrl)) return next(req);
  const auth = inject(AuthService);
  return from(auth.freshToken()).pipe(
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};
