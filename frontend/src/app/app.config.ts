import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AuthService, isLoginCallback } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    // La page d'accueil s'affiche sans attendre Keycloak. Au retour de la page de connexion, on attend en revanche
    // que keycloak-js ait lu le code d'autorisation dans l'URL, avant que le routeur ne la modifie.
    provideAppInitializer(() => {
      const ready = inject(AuthService).whenReady();
      return isLoginCallback() ? ready : undefined;
    }),
  ],
};
