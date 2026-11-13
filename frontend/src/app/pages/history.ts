import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { ChargeSession } from '../models';
import { errorMessage } from '../util';

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <h1>Historique des charges</h1>
    <p class="hint">Retrouvez toutes vos sessions de recharge passées.</p>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Borne</th><th>Décision</th><th>Statut</th></tr>
        </thead>
        <tbody>
          @for (s of sessions(); track s.id) {
            <tr>
              <td>{{ s.startedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ s.stationName }}</td>
              <td>
                @if (s.decision) {
                  <span class="badge" [class]="s.decision.toLowerCase()">
                    {{ decisionLabel(s.decision) }}
                  </span>
                } @else {
                  <span class="badge">—</span>
                }
              </td>
              <td>
                <span class="status" [class]="statusClass(s.status)">
                  {{ statusLabel(s.status) }}
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="empty">Aucune session pour le moment. Commencez par recharger votre véhicule.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .status { font-size: 0.875rem; }
    .status.active { color: var(--ok); }
    .status.denied { color: var(--ko); }
    .status.stopped { color: var(--muted); }
    .status.pending { color: var(--warn); }
  `]
})
export class HistoryPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly sessions = signal<ChargeSession[]>([]);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.sessions.set(await this.api.mySessions());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected decisionLabel(decision: string): string {
    return { ALLOW: 'Autorisé', MFA: 'MFA', DENY: 'Refusé' }[decision] ?? decision;
  }

  protected statusLabel(status: string): string {
    return {
      ACTIVE: 'En cours',
      PENDING_MFA: 'En attente MFA',
      DENIED: 'Refusée',
      STOPPED: 'Terminée',
    }[status] ?? status;
  }

  protected statusClass(status: string): string {
    return {
      ACTIVE: 'active',
      PENDING_MFA: 'pending',
      DENIED: 'denied',
      STOPPED: 'stopped',
    }[status] ?? '';
  }
}
