import { Injectable, computed, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { CONFIG } from './config';
import { Role } from './models';

const ROLE_ORDER: Role[] = ['Admin', 'Fleet', 'User'];

/**
 * Authentification via Keycloak (flux Authorization Code + PKCE). Aucun mot de passe ne transite par l'application.
 *
 * La page d'accueil est publique : au demarrage, on verifie seulement s'il existe deja une session Keycloak
 * (check-sso, sans redirection). La connexion n'est exigee que pour les routes de l'espace prive (authGuard).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly kc = new Keycloak({
    url: CONFIG.keycloak.url,
    realm: CONFIG.keycloak.realm,
    clientId: CONFIG.keycloak.clientId,
  });
  private ready?: Promise<boolean>;

  readonly authenticated = signal(false);
  /** true une fois la verification de session terminee (connecte ou non). */
  readonly checked = signal(false);
  readonly username = signal('');
  readonly roles = signal<string[]>([]);
  /** Role le plus eleve de l'utilisateur. */
  readonly role = computed<Role | null>(() => ROLE_ORDER.find((r) => this.roles().includes(r)) ?? null);

  /** Lance (une seule fois) la verification de session. Ne redirige jamais : renvoie false si personne n'est connecte. */
  whenReady(): Promise<boolean> {
    this.ready ??= this.kc
      .init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then((authenticated) => {
        if (authenticated) {
          this.username.set(this.kc.tokenParsed?.['preferred_username'] ?? '');
          this.roles.set(this.kc.tokenParsed?.realm_access?.roles ?? []);
        }
        this.authenticated.set(authenticated);
        return authenticated;
      })
      .catch((err) => {
        // Keycloak injoignable : la page publique reste utilisable, l'espace prive demandera une connexion.
        console.warn('Verification de session Keycloak impossible', err);
        return false;
      })
      .finally(() => this.checked.set(true));
    return this.ready;
  }

  /** Redirige vers la page de connexion Keycloak (identifiant pré-rempli si fourni), puis revient sur `path`. */
  login(path = '/stations', loginHint?: string): Promise<void> {
    return this.kc.login({ redirectUri: window.location.origin + path, loginHint });
  }

  /** Jeton d'acces valide (renouvele s'il expire dans moins de 30 s). */
  async freshToken(): Promise<string> {
    await this.whenReady();
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

/** true si l'URL courante est le retour de la page de connexion Keycloak (code d'autorisation dans le fragment). */
export function isLoginCallback(): boolean {
  const hash = window.location.hash;
  return hash.includes('state=') && (hash.includes('code=') || hash.includes('error='));
}
