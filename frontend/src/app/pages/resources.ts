import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { Decision, Policy } from '../models';
import { errorMessage } from '../util';
import { DecisionCard } from './decision-card';

@Component({
  selector: 'app-resources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecisionCard],
  template: `
    <div class="page-header">
      <div class="page-header-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
      </div>
      <div>
        <h1>Politiques d'accès</h1>
        <p class="hint">Chaque ressource a sa propre politique de sécurité. Cliquez sur "Tester" pour simuler une demande d'accès.</p>
      </div>
    </div>

    @if (error()) { <div class="alert error">{{ error() }}</div> }

    <div class="policy-grid">
      @for (r of rows(); track r.name) {
        <div class="policy-card">
          <div class="policy-card-header">
            <code>{{ r.name }}</code>
            <span class="badge" [class]="r.policy.require_trusted_device ? 'allow' : ''">
              {{ r.policy.require_trusted_device ? 'Appareil fiable' : 'Appareil libre' }}
            </span>
          </div>

          <div class="policy-details">
            <div class="policy-detail">
              <span class="detail-label">Rôle minimum</span>
              <span class="detail-value">{{ r.policy.min_role }}</span>
            </div>
            <div class="policy-detail">
              <span class="detail-label">Seuil MFA</span>
              <span class="detail-value warn">{{ r.policy.mfa_threshold }}</span>
            </div>
            <div class="policy-detail">
              <span class="detail-label">Seuil de refus</span>
              <span class="detail-value deny">{{ r.policy.deny_threshold }}</span>
            </div>
            <div class="policy-detail">
              <span class="detail-label">Horaires (UTC)</span>
              <span class="detail-value">{{ r.policy.start_hour }}h – {{ r.policy.end_hour }}h</span>
            </div>
          </div>

          <button class="primary small" (click)="test(r.name)" [disabled]="busy() !== ''">
            {{ busy() === r.name ? 'Test en cours…' : 'Tester cette ressource' }}
          </button>
        </div>
      } @empty {
        <p class="hint">Aucune politique disponible.</p>
      }
    </div>

    @if (decision(); as d) {
      <section class="card result">
        <h3>Résultat du test sur <code>{{ tested() }}</code></h3>
        <app-decision-card [decision]="d" mode="admin" />
      </section>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
    .page-header-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-soft); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .page-header h1 { margin: 0 0 0.25rem; }
    .page-header .hint { margin: 0; }

    /* Grille : flex centré, 3 cartes par ligne max */
    .policy-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .policy-card {
      width: calc(33.333% - 0.85rem);
      min-width: 280px;
      max-width: 380px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 240px;
    }

    .policy-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .policy-card-header code { font-size: 0.9rem; font-weight: 600; word-break: break-all; }

    .policy-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      flex: 1;
      align-content: start;
      margin-bottom: 1rem;
    }
    .policy-detail { display: flex; flex-direction: column; }
    .detail-label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.15rem; }
    .detail-value { font-size: 0.95rem; font-weight: 600; }
    .detail-value.warn { color: var(--warn); }
    .detail-value.deny { color: var(--ko); }

    .policy-card button { margin-top: auto; }

    /* Écrans moyens : 2 cartes par ligne */
    @media (max-width: 1100px) {
      .policy-card { width: calc(50% - 0.65rem); }
    }
    /* Petits écrans : 1 carte par ligne */
    @media (max-width: 700px) {
      .policy-card { width: 100%; max-width: none; }
    }
  `]
})
export class ResourcesPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly policies = signal<Record<string, Policy>>({});
  protected readonly rows = computed(() =>
    Object.entries(this.policies()).map(([name, policy]) => ({ name, policy })),
  );
  protected readonly decision = signal<Decision | null>(null);
  protected readonly tested = signal('');
  protected readonly busy = signal('');
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.policies.set(await this.api.resources());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async test(resource: string): Promise<void> {
    this.error.set('');
    this.busy.set(resource);
    try {
      this.decision.set(await this.api.checkAccess(resource));
      this.tested.set(resource);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }
}
