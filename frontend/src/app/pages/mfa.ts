import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';
import { MfaEnrollment, MfaStatus } from '../models';
import { errorMessage } from '../util';

/**
 * Activation de la MFA par l'utilisateur connecté : il scanne un QR code avec Google Authenticator
 * ou Microsoft Authenticator, puis saisit un premier code pour confirmer.
 * Le secret n'est affiché que pendant l'activation ; il n'est jamais stocké dans le navigateur.
 */
@Component({
  selector: 'app-mfa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <h1>Activer la MFA</h1>
    <p class="hint">
      Quand le risque d'une demande est élevé (appareil inconnu, zone inhabituelle…), un code à 6 chiffres
      généré par votre téléphone vous est demandé.
    </p>
    @if (error()) { <div class="alert error">{{ error() }}</div> }
    @if (info()) { <div class="alert ok">{{ info() }}</div> }

    @if (enrollment(); as e) {
      <section class="card">
        <h3>{{ renewing() ? 'Renouveler' : 'Activer' }} la MFA</h3>
        <ol class="steps">
          <li>Installez <b>Google Authenticator</b> ou <b>Microsoft Authenticator</b> sur votre téléphone.</li>
          <li>
            Dans l'application, choisissez <i>Ajouter un compte</i> puis <i>Scanner un code QR</i> :
            <div class="qr"><img [src]="e.qr_svg" width="220" height="220" alt="QR code d'activation de la MFA" /></div>
            <details>
              <summary>Impossible de scanner ? Saisir la clé manuellement</summary>
              <p>Compte : <code>{{ e.issuer }} ({{ e.user }})</code> — type : <i>basé sur l'heure</i></p>
              <p>Clé : <code class="secret">{{ groupedSecret() }}</code></p>
            </details>
          </li>
          <li>
            Saisissez le code à 6 chiffres affiché par l'application :
            <form class="inline" (submit)="confirm($event)">
              <input id="mfa-code" name="code" [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric"
                     maxlength="6" placeholder="123456" autocomplete="one-time-code" />
              <button type="submit" [disabled]="!validCode() || busy()">Confirmer</button>
              <button type="button" class="secondary" (click)="cancel()" [disabled]="busy()">Annuler</button>
            </form>
          </li>
        </ol>
        <p class="hint">
          Ce QR code n'est affiché qu'une fois et expire dans {{ e.expires_in_seconds / 60 }} minutes.
          Il ne sera plus jamais affiché après l'activation, ni à vous ni à l'administrateur.
        </p>
      </section>
    } @else if (status(); as s) {
      <section class="card">
        @if (s.enabled) {
          <h3>MFA activée <span class="badge allow">Active</span></h3>
          <p>Activée le {{ formatDate(s.enabled_at) }}. Les codes de votre application d'authentification sont acceptés.</p>
          <h4>Renouveler le secret</h4>
          <p class="hint">
            Nouveau téléphone ? Saisissez un code de votre application actuelle pour générer un nouveau QR code.
            L'ancien reste valable tant que le nouveau n'est pas confirmé. Si vous avez perdu votre téléphone,
            demandez à un administrateur de réinitialiser votre MFA.
          </p>
          <form class="inline" (submit)="renew($event)">
            <input name="current" [ngModel]="currentCode()" (ngModelChange)="currentCode.set($event)" inputmode="numeric"
                   maxlength="6" placeholder="Code actuel" autocomplete="one-time-code" />
            <button type="submit" class="secondary" [disabled]="currentCode().trim().length !== 6 || busy()">Renouveler</button>
          </form>
        } @else {
          <h3>MFA non activée <span class="badge deny">Inactive</span></h3>
          @if (s.needs_reactivation) {
            <div class="alert warn">
              Votre ancien secret TOTP (créé par l'administrateur) a été désactivé pour des raisons de sécurité.
              Réactivez la MFA avec votre propre application d'authentification.
            </div>
          }
          <p>Sans MFA activée, toute demande nécessitant une vérification supplémentaire sera refusée.</p>
          <button (click)="start()" [disabled]="busy()">Activer la MFA</button>
        }
      </section>
    } @else if (!error()) {
      <p class="hint">Chargement…</p>
    }
  `,
  styles: `
    .steps { padding-left: 20px; display: flex; flex-direction: column; gap: 14px; }
    .qr { margin: 10px 0; }
    .qr img { background: #fff; padding: 8px; border-radius: 8px; border: 1px solid var(--border); }
    .secret { font-size: 15px; letter-spacing: 1px; word-break: break-all; }
    .inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
    .inline input { width: 130px; }
    details { font-size: 14px; }
    summary { cursor: pointer; color: var(--muted); }
  `,
})
export class MfaPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly status = signal<MfaStatus | null>(null);
  protected readonly enrollment = signal<MfaEnrollment | null>(null);
  protected readonly renewing = signal(false);
  protected readonly code = signal('');
  protected readonly currentCode = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal('');

  protected readonly validCode = computed(() => /^\d{6}$/.test(this.code().trim()));
  protected readonly groupedSecret = computed(() => this.enrollment()?.secret.match(/.{1,4}/g)?.join(' ') ?? '');

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.status.set(await this.api.mfaStatus());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected start(): Promise<void> {
    return this.enroll(undefined);
  }

  protected renew(event: Event): Promise<void> {
    event.preventDefault();
    return this.enroll(this.currentCode().trim());
  }

  private async enroll(currentOtp: string | undefined): Promise<void> {
    this.reset();
    this.busy.set(true);
    try {
      this.enrollment.set(await this.api.mfaEnroll(currentOtp));
      this.renewing.set(!!currentOtp);
      this.currentCode.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirm(event: Event): Promise<void> {
    event.preventDefault();
    this.reset();
    this.busy.set(true);
    try {
      this.status.set(await this.api.mfaConfirm(this.code().trim()));
      this.enrollment.set(null); // le secret quitte la mémoire de la page
      this.info.set('MFA activée. Votre application d\'authentification vous servira lors des vérifications supplémentaires.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.code.set('');
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.enrollment.set(null);
    this.code.set('');
    this.reset();
  }

  protected formatDate(seconds: number | null): string {
    return seconds ? new Date(seconds * 1000).toLocaleString('fr-FR') : '-';
  }

  private reset(): void {
    this.error.set('');
    this.info.set('');
  }
}
