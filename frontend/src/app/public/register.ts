import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { LpIcon } from '../landing/lp-icon';
import { BrandMark } from '../shared/brand-mark';
import { errorMessage } from '../util';

type Field = 'username' | 'email' | 'password' | 'confirm' | 'terms';

const USERNAME = /^[a-z0-9._-]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Inscription en libre-service (rôle « User » imposé côté serveur). Après la création du compte,
 * l'utilisateur se connecte via Keycloak puis arrive directement sur l'activation de la MFA.
 */
@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandMark, LpIcon],
  templateUrl: './register.html',
  styleUrl: './register.css',
  host: { class: 'lp' },
})
export class RegisterPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  protected readonly cities = ['Lyon', 'Paris', 'Marseille'];

  protected readonly username = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly city = signal('Lyon');
  protected readonly terms = signal(false);
  protected readonly website = signal('');

  protected readonly showPassword = signal(false);
  protected readonly touched = signal<Partial<Record<Field, boolean>>>({});
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly created = signal<string | null>(null);

  protected readonly rules = computed(() => {
    const pwd = this.password();
    const user = this.username().trim();
    return [
      { label: '10 caractères minimum', ok: pwd.length >= 10 },
      { label: 'Au moins une lettre', ok: /\p{L}/u.test(pwd) },
      { label: 'Au moins un chiffre', ok: /\d/.test(pwd) },
      { label: 'Ne contient pas l’identifiant', ok: pwd.length > 0 && (!user || !pwd.toLowerCase().includes(user)) },
    ];
  });

  /** 0 à 4 : règles respectées, plus un bonus pour la longueur et la variété. */
  protected readonly strength = computed(() => {
    const pwd = this.password();
    if (!pwd) return 0;
    const base = this.rules().filter((r) => r.ok).length;
    if (base < 4) return pwd.length < 10 ? 1 : 2;
    const bonus = (pwd.length >= 14 ? 1 : 0) + (/[^\p{L}\d]/u.test(pwd) || (/\p{Lu}/u.test(pwd) && /\p{Ll}/u.test(pwd)) ? 1 : 0);
    return bonus >= 1 ? 4 : 3;
  });
  protected readonly strengthLabel = computed(() => ['', 'Faible', 'Moyen', 'Bon', 'Excellent'][this.strength()]);

  protected readonly errors = computed<Record<Field, string>>(() => ({
    username: !this.username() ? 'Choisissez un identifiant.' : USERNAME.test(this.username()) ? '' : '3 à 30 caractères : minuscules, chiffres, point, tiret.',
    email: !this.email() ? 'Indiquez votre adresse e-mail.' : EMAIL.test(this.email().trim()) ? '' : 'Adresse e-mail invalide.',
    password: this.rules().every((r) => r.ok) ? '' : 'Le mot de passe ne respecte pas toutes les règles.',
    confirm: !this.confirm() ? 'Confirmez le mot de passe.' : this.confirm() === this.password() ? '' : 'Les deux mots de passe sont différents.',
    terms: this.terms() ? '' : 'Votre accord est nécessaire pour créer un compte.',
  }));
  protected readonly valid = computed(() => Object.values(this.errors()).every((e) => !e));

  protected show(field: Field): string {
    return this.submitted() || this.touched()[field] ? this.errors()[field] : '';
  }

  protected touch(field: Field): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  protected onUsername(value: string): void {
    this.username.set(value.toLowerCase().replace(/\s/g, ''));
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.error.set('');
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.api.register({
        username: this.username(),
        email: this.email().trim(),
        password: this.password(),
        homeLocation: this.city() || undefined,
        acceptTerms: this.terms(),
        website: this.website(),
      });
      this.password.set('');
      this.confirm.set('');
      this.created.set(res.username);
    } catch (e) {
      this.error.set(this.describe(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected signIn(): void {
    void this.auth.login('/stations');
  }

  protected login(): void {
    void this.auth.login('/mfa?bienvenue=1', this.created() ?? undefined);
  }

  private describe(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 409) return 'Cet identifiant ou cette adresse e-mail est déjà utilisé.';
      if (e.status === 502 || e.status === 503) return 'Service momentanément indisponible. Réessayez dans un instant.';
    }
    return errorMessage(e);
  }
}
