import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Garde de route : n'autorise que les roles donnes (le backend revérifie de toute façon chaque appel). */
export const roleGuard =
  (...allowed: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return auth.hasAnyRole(allowed) ? true : inject(Router).parseUrl('/stations');
  };
