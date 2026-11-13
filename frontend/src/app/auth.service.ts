import { Injectable, computed, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { CONFIG } from './config';
import { Role } from './models';

const ROLE_ORDER: Role[] = ['Admin', 'Fleet', 'User'];

/** Authentification via Keycloak (flux Authorization Code + PKCE). Aucun mot de passe ne transite par l'application. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly kc = new Keycloak({
    url: CONFIG.keycloak.url,
    realm: CONFIG.keycloak.realm,
    clientId: CONFIG.keycloak.clientId,
  });

  readonly username = signal('');
  readonly roles = signal<string[]>([]);
  /** Role le plus eleve de l'utilisateur. */
  readonly role = computed<Role | null>(() => ROLE_ORDER.find((r) => this.roles().includes(r)) ?? null);

  /** Appele au demarrage : redirige vers la page de connexion Keycloak si l'utilisateur n'est pas connecte. */
  async init(): Promise<void> {
    const authenticated = await this.kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
    if (!authenticated) return;
    this.username.set(this.kc.tokenParsed?.['preferred_username'] ?? '');
    this.roles.set(this.kc.tokenParsed?.realm_access?.roles ?? []);
  }

  /** Jeton d'acces valide (renouvele s'il expire dans moins de 30 s). */
  async freshToken(): Promise<string> {
    try {
      await this.kc.updateToken(30);
    } catch {
      await this.kc.login();
    }
    return this.kc.token ?? '';
  }

  hasAnyRole(allowed: readonly string[]): boolean {
    return allowed.some((r) => this.roles().includes(r));
  }

  logout(): void {
    this.kc.logout({ redirectUri: window.location.origin });
  }
}
