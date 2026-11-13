import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { AuthService } from '../auth.service';
import { DeviceService } from '../device.service';
import { ChargeResult, Station } from '../models';
import { errorMessage } from '../util';
import { DecisionCard } from './decision-card';

@Component({
  selector: 'app-stations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DecisionCard],
  template: `
    @if (isAdmin) {
      <div class="page-header">
        <div>
          <h1>Tableau de bord des bornes</h1>
          <p class="hint">Vue d'ensemble de toutes les bornes. Vous pouvez arrêter une charge en cours.</p>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span>Total bornes</span>
          <b>{{ stations().length }}</b>
        </div>
        <div class="stat">
          <span>Libres</span>
          <b class="ok">{{ availableCount() }}</b>
        </div>
        <div class="stat">
          <span>Occupées</span>
          <b class="ko">{{ busyCount() }}</b>
        </div>
        <div class="stat">
          <span>Puissance totale</span>
          <b>{{ totalPower() }} kW</b>
        </div>
      </div>

      <div class="filter-bar">
        <button class="secondary small" [class.active]="filter() === 'all'" (click)="filter.set('all')">Toutes</button>
        <button class="secondary small" [class.active]="filter() === 'available'" (click)="filter.set('available')">Libres</button>
        <button class="secondary small" [class.active]="filter() === 'busy'" (click)="filter.set('busy')">Occupées</button>
      </div>
    } @else {
      <h1>Bornes de recharge</h1>
      <p class="hint">
        Chaque demande est évaluée en temps réel : identité, appareil, heure, zone et comportement réseau
        (score de risque IA), puis tranchée par un smart contract et journalisée sur la blockchain.
      </p>
    }

    @if (error()) { <div id="error" class="alert error" role="alert">{{ error() }}</div> }

    <div class="grid">
      @for (s of filteredStations(); track s.id) {
        <article class="card station" [class.busy]="!s.available">
          <header>
            <div class="station-header-left">
              <div class="station-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <h2>{{ s.name }}</h2>
            </div>
            <span class="badge" [class]="s.available ? 'allow' : 'deny'">{{ s.available ? 'Libre' : 'Occupée' }}</span>
          </header>
          <div class="station-info">
            <p><strong>{{ s.powerKw }}</strong> kW</p>
            <p>{{ s.city }}</p>
          </div>
          @if (s.activeUser) { <p class="user-line">Utilisée par <b>{{ s.activeUser }}</b></p> }

          @if (isAdmin) {
            @if (!s.available && s.canStop) {
              <button class="danger small" (click)="stopStation(s)" [disabled]="busy() !== null">
                {{ busy() === s.id ? 'Arrêt…' : 'Arrêter la charge' }}
              </button>
            }
          } @else {
            @if (s.available) {
              <button class="primary" (click)="charge(s)" [disabled]="busy() !== null">
                {{ busy() === s.id ? 'Évaluation…' : 'Démarrer la charge' }}
              </button>
            } @else if (s.canStop) {
              <button class="secondary" (click)="stopStation(s)" [disabled]="busy() !== null">
                {{ busy() === s.id ? 'Arrêt…' : 'Arrêter la charge' }}
              </button>
            } @else {
              <button class="secondary" disabled>Utilisée par un autre utilisateur</button>
            }
          }
        </article>
      } @empty {
        <p class="hint">Aucune borne dans cette catégorie.</p>
      }
    </div>

    @if (result(); as r) {
      <section id="result" class="card result">
        <h3>Résultat — {{ stationName() }}</h3>
        @if (r.decision) { <app-decision-card [decision]="r.decision" [mode]="isAdmin ? 'admin' : 'user'" /> }

        @switch (r.session.status) {
          @case ('ACTIVE') {
            <div class="alert ok">Charge en cours (session n°{{ r.session.id }}).</div>
            <button class="secondary" (click)="stopResult(r)" [disabled]="busy() !== null">Arrêter la charge</button>
          }
          @case ('PENDING_MFA') {
            @if (mfaEnabled() === false) {
              <div class="alert warn">
                Vérification supplémentaire requise, mais votre MFA n'est pas encore activée.
                <a routerLink="/mfa">Activez-la en scannant un QR code</a>, puis relancez la charge.
              </div>
            } @else {
              <div class="alert warn">
                Vérification supplémentaire requise. Entrez le code à 6 chiffres de votre application d'authentification.
              </div>
              <form class="inline" (submit)="submitOtp($event, r)">
                <input id="otp" name="otp" [ngModel]="otp()" (ngModelChange)="otp.set($event)" inputmode="numeric"
                       maxlength="6" placeholder="123456" autocomplete="one-time-code" />
                <button type="submit" [disabled]="otp().length !== 6 || busy() !== null">Valider</button>
              </form>
            }
          }
          @case ('DENIED') {
            <div class="alert error">
              Accès refusé : aucune charge n'a démarré. La tentative est enregistrée dans l'historique et dans le journal blockchain.
            </div>
          }
          @case ('STOPPED') {
            @if (r.decision?.decision === 'DENY') {
              <div class="alert warn">
                Charge arrêtée. Un arrêt n'est jamais bloqué par sécurité, même si la politique Zero Trust a émis un refus
                pour cette requête (par exemple pendant une attaque).
              </div>
            } @else {
              <div class="alert ok">Charge terminée.</div>
            }
          }
        }
      </section>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 2rem; }
    .page-header h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
    .page-header .hint { font-size: 0.95rem; }

    /* Statistiques */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      text-align: center;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .stat:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .stat span {
      display: block;
      color: var(--muted);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.4rem;
    }
    .stat b { font-size: 1.75rem; font-weight: 700; }
    .stat b.ok { color: var(--ok); }
    .stat b.ko { color: var(--ko); }

    /* Filtre */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      padding: 0.4rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      width: fit-content;
    }
    .filter-bar button {
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--muted);
      padding: 0.4rem 1rem;
      font-weight: 500;
    }
    .filter-bar button.active {
      background: var(--accent);
      color: white;
    }

    /* Cartes des bornes */
    .station {
      transition: transform 0.15s, box-shadow 0.15s;
      border-left: 4px solid var(--ok);
    }
    .station:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }
    .station.busy {
      border-left-color: var(--ko);
    }
    .station header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .station-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .station-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--accent-soft);
      color: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .station h2 { font-size: 1.05rem; margin: 0; }
    .station-info {
      display: flex;
      gap: 1rem;
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 0.75rem;
    }
    .station-info p { margin: 0; }
    .user-line {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 0.75rem;
    }
    .fleet-section {
      margin-top: 2rem;
      border-left: 4px solid var(--accent);
    }
    .fleet-section h3 {
      color: var(--accent);
    }
    .badge {
      padding: 0.25rem 0.7rem;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
    }
  `]
})
export class StationsPage implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly deviceService = inject(DeviceService);
  private readonly injector = inject(Injector);

  protected readonly isAdmin = this.auth.role() === 'Admin';
  protected readonly stations = signal<Station[]>([]);
  protected readonly filter = signal<'all' | 'available' | 'busy'>('all');

  protected readonly availableCount = computed(() => this.stations().filter(s => s.available).length);
  protected readonly busyCount = computed(() => this.stations().filter(s => !s.available).length);
  protected readonly totalPower = computed(() => this.stations().reduce((sum, s) => sum + s.powerKw, 0));

  protected readonly filteredStations = computed(() => {
    const f = this.filter();
    const all = this.stations();
    if (f === 'available') return all.filter(s => s.available);
    if (f === 'busy') return all.filter(s => !s.available);
    return all;
  });

  private timer?: ReturnType<typeof setInterval>;
  protected readonly result = signal<ChargeResult | null>(null);
  protected readonly stationName = signal('');
  protected readonly otp = signal('');
  /** null : inconnu (pas encore vérifié). */
  protected readonly mfaEnabled = signal<boolean | null>(null);
  protected readonly busy = signal<number | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
    if (this.isAdmin) this.timer = setInterval(() => void this.load(true), 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private async load(silent = false): Promise<void> {
    try {
      this.stations.set(await this.api.stations());
    } catch (e) {
      if (silent) this.error.set(errorMessage(e));
      else this.fail(e);
    }
  }

  protected async charge(station: Station, otp?: string): Promise<void> {
    this.error.set('');
    this.busy.set(station.id);
    try {
      await this.deviceService.register(this.auth.username() ?? '');
      const body = { device: this.deviceService.get(), otp };
      const res = await this.api.charge(station.id, body);
      this.result.set(res);
      this.stationName.set(`${station.name} (${station.city})`);
      this.otp.set('');
      if (res.session.status === 'PENDING_MFA') {
        this.mfaEnabled.set(await this.api.mfaStatus().then((st) => st.enabled, () => null));
      }
      this.after(res.session.status === 'PENDING_MFA' ? 'otp' : 'result');
      await this.load();
    } catch (e) {
      this.fail(e);
      await this.load();
    } finally {
      this.busy.set(null);
    }
  }

  protected submitOtp(event: Event, r: ChargeResult): void {
    event.preventDefault();
    const station = this.stations().find((s) => s.id === r.session.stationId);
    if (station) void this.charge(station, this.otp());
  }

  protected async stopStation(station: Station): Promise<void> {
    if (station.activeSessionId === null) return;
    await this.stop(station.activeSessionId, station.id, `${station.name} (${station.city})`);
  }

  protected async stopResult(r: ChargeResult): Promise<void> {
    await this.stop(r.session.id, r.session.stationId, this.stationName());
  }

  private async stop(sessionId: number, stationId: number, label: string): Promise<void> {
    this.error.set('');
    this.busy.set(stationId);
    try {
      this.result.set(await this.api.stopSession(sessionId));
      this.stationName.set(label);
      this.after('result');
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(null);
      await this.load();
    }
  }

  private fail(e: unknown): void {
    this.error.set(errorMessage(e));
    this.after('error');
  }

  private after(id: 'result' | 'error' | 'otp'): void {
    afterNextRender(
      () => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'otp') (el as HTMLInputElement).focus();
        else el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      { injector: this.injector },
    );
  }
}
