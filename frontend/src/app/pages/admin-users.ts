import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { CreatedUser, KcUser, NewUser } from '../models';
import { errorMessage } from '../util';

/**
 * Gestion des utilisateurs : Keycloak (compte, mot de passe, role) + blockchain (identite, appareil).
 * L'admin ne voit jamais les secrets ni les codes TOTP : chaque utilisateur active sa MFA par QR code.
 */
@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <h1>Utilisateurs</h1>
    @if (error()) { <div class="alert error">{{ error() }}</div> }
    @if (info()) { <div class="alert ok">{{ info() }}</div> }

    <div class="table-wrap">
      <table>
        <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>État</th><th></th></tr></thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr>
              <td>{{ u.username }}</td>
              <td>{{ u.email ?? '-' }}</td>
              <td>{{ u.role ?? '-' }}</td>
              <td><span class="badge" [class]="u.enabled ? 'allow' : 'deny'">{{ u.enabled ? 'Actif' : 'Révoqué' }}</span></td>
              <td class="actions">
                <button class="secondary small" (click)="resetMfa(u)" [disabled]="!u.enabled"
                        title="Téléphone perdu : l'utilisateur devra réactiver sa MFA">Réinitialiser MFA</button>
                <button class="danger-outline small" (click)="revoke(u)"
                        [disabled]="!u.enabled || u.username === auth.username()">Révoquer</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <section class="card">
      <h3>Nouvel utilisateur</h3>
      <form class="form" (submit)="create($event)">
        <label>Identifiant <input name="username" [(ngModel)]="form.username" required /></label>
        <label>E-mail <input name="email" type="email" [(ngModel)]="form.email" required /></label>
        <label>Mot de passe <input name="password" type="password" [(ngModel)]="form.password" minlength="8" required /></label>
        <label>Rôle
          <select name="role" [(ngModel)]="form.role">
            <option value="User">User</option>
            <option value="Fleet">Fleet</option>
            <option value="Admin">Admin</option>
          </select>
        </label>
        <label>Zone habituelle <input name="home" [(ngModel)]="form.homeLocation" placeholder="Lyon" /></label>
        <button type="submit" [disabled]="busy()">Créer</button>
      </form>
      @if (created(); as c) {
        <div class="alert ok">
          <b>{{ c.username }}</b> créé (rôle {{ c.role }}). Appareil <code>{{ c.device }}</code> enregistré.
          À sa première connexion, l'utilisateur active sa MFA dans <b>Sécurité (MFA)</b> en scannant un QR code.
        </div>
      }
    </section>
  `,
})
export class AdminUsersPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly users = signal<KcUser[]>([]);
  protected readonly created = signal<CreatedUser | null>(null);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly busy = signal(false);
  protected form: NewUser = { username: '', email: '', password: '', role: 'User', homeLocation: 'Lyon' };

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.users.set(await this.api.users());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');
    this.info.set('');
    this.busy.set(true);
    try {
      this.created.set(await this.api.createUser(this.form));
      this.form = { username: '', email: '', password: '', role: 'User', homeLocation: 'Lyon' };
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async revoke(user: KcUser): Promise<void> {
    if (!confirm(`Révoquer ${user.username} ? Son accès sera coupé immédiatement. Il n'existe pas de réactivation depuis l'interface.`)) return;
    this.error.set('');
    try {
      await this.api.revokeUser(user.username);
      this.info.set(`${user.username} révoqué (blockchain + Keycloak).`);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async resetMfa(user: KcUser): Promise<void> {
    if (!confirm(`Réinitialiser la MFA de ${user.username} ? Son application d'authentification actuelle ne sera plus acceptée ; il devra scanner un nouveau QR code.`)) return;
    this.error.set('');
    this.info.set('');
    try {
      await this.api.resetUserMfa(user.username);
      this.info.set(`MFA de ${user.username} réinitialisée : il doit la réactiver dans « Sécurité (MFA) ».`);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
