import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Espace prive : exige une session Keycloak, sinon redirige vers la page de connexion puis revient ici. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  if (await auth.whenReady()) return true;
  await auth.login(state.url);
  return false;
};
