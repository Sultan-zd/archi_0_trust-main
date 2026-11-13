import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { AuditEntry, ChargeSession, IntegrityResult, Overview } from '../models';
import { errorMessage, reasonText, shortHash } from '../util';

type DecisionSeries = 'ALLOW' | 'MFA' | 'DENY';

interface TimelinePoint {
  timestamp: number;
  label: string;
  ALLOW: number;
  MFA: number;
  DENY: number;
}

interface RiskBucket {
  label: string;
  count: number;
}

interface StationDecisionCount {
  name: string;
  total: number;
  ALLOW: number;
  MFA: number;
  DENY: number;
}

/** Supervision : etat du systeme, simulation d'attaque, journal blockchain et controle d'integrite des preuves. */
@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <h1>Supervision</h1>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @if (overview(); as o) {
      <div class="stats">
        <div class="stat"><span>API Zero Trust</span><b [class]="o.fastapi === 'UP' ? 'ok' : 'ko'">{{ o.fastapi }}</b></div>
        <div class="stat"><span>Bloc blockchain</span><b>{{ o.block ?? '-' }}</b></div>
        <div class="stat"><span>Sessions</span><b>{{ o.totalSessions }}</b></div>
        <div class="stat"><span>Charges actives</span><b>{{ o.activeSessions }}</b></div>
        <div class="stat"><span>ALLOW</span><b class="ok">{{ o.byDecision['ALLOW'] ?? 0 }}</b></div>
        <div class="stat"><span>MFA</span><b class="warn">{{ o.byDecision['MFA'] ?? 0 }}</b></div>
        <div class="stat"><span>DENY</span><b class="ko">{{ o.byDecision['DENY'] ?? 0 }}</b></div>
      </div>

      <p class="hint small">
        @if (o.decisionSource === 'blockchain') {
          ALLOW / MFA / DENY : décisions du journal blockchain ({{ o.auditTotal }} au total ; les 500 dernières sont comptées).
        } @else {
          ALLOW / MFA / DENY : sessions de charge (journal blockchain indisponible).
        }
      </p>

      @if (o.attackActive) {
        <div class="alert error">
          <b>Attaque réseau détectée par le sniffer.</b>
          Le moteur IA analyse un flux de type DoS : toute demande de charge est refusée.
        </div>
      } @else {
        <p class="hint small">Trafic réseau normal (surveillé par le sniffer).</p>
      }
    }

    <section class="charts" aria-label="Graphiques de supervision">
      <article class="chart-card">
        <div class="chart-heading">
          <div>
            <h2>Décisions dans le temps</h2>
            <p class="hint small">12 périodes de 10 minutes · journal blockchain</p>
          </div>
        </div>
        @if (audit().length) {
          <svg class="timeline-chart" viewBox="0 0 640 240" role="img" aria-label="Décisions ALLOW, MFA et DENY au cours des deux dernières heures">
            @for (tick of timelineTicks(); track tick.value) {
              <line x1="42" x2="630" [attr.y1]="timelineY(tick.value)" [attr.y2]="timelineY(tick.value)" class="grid-line" />
              <text x="34" [attr.y]="timelineY(tick.value) + 4" text-anchor="end" class="axis-label">{{ tick.value }}</text>
            }
            @for (point of timelineLabels(); track point.timestamp) {
              <text [attr.x]="timelineX(point.timestamp)" y="218" text-anchor="middle" class="axis-label">{{ point.label }}</text>
            }
            <polyline [attr.points]="linePoints('ALLOW')" class="series-line allow-line" />
            <polyline [attr.points]="linePoints('MFA')" class="series-line mfa-line" />
            <polyline [attr.points]="linePoints('DENY')" class="series-line deny-line" />
            @for (point of timeline(); track point.timestamp) {
              <circle [attr.cx]="timelineX(point.timestamp)" [attr.cy]="timelineY(point.ALLOW)" r="3" class="allow-dot" />
              <circle [attr.cx]="timelineX(point.timestamp)" [attr.cy]="timelineY(point.MFA)" r="3" class="mfa-dot" />
              <circle [attr.cx]="timelineX(point.timestamp)" [attr.cy]="timelineY(point.DENY)" r="3" class="deny-dot" />
            }
          </svg>
          <div class="chart-legend">
            <span><i class="legend-dot allow-dot"></i>ALLOW</span>
            <span><i class="legend-dot mfa-dot"></i>MFA</span>
            <span><i class="legend-dot deny-dot"></i>DENY</span>
          </div>
        } @else {
          <p class="empty-chart">Aucune décision à afficher.</p>
        }
      </article>

      <article class="chart-card">
        <div class="chart-heading">
          <div>
            <h2>Répartition des risques</h2>
            <p class="hint small">Scores des {{ audit().length }} dernières décisions</p>
          </div>
        </div>
        @if (audit().length) {
          <div class="risk-chart" role="img" aria-label="Nombre de décisions par tranche de risque">
            @for (bucket of riskBuckets(); track bucket.label) {
              <div class="risk-column">
                <span class="risk-count">{{ bucket.count }}</span>
                <div class="risk-bar-track">
                  <div class="risk-bar" [style.height.%]="barHeight(bucket.count, maxRiskCount())"></div>
                </div>
                <span class="risk-label">{{ bucket.label }}</span>
              </div>
            }
          </div>
        } @else {
          <p class="empty-chart">Aucune décision à afficher.</p>
        }
      </article>

      <article class="chart-card station-chart-card">
        <div class="chart-heading">
          <div>
            <h2>Décisions par borne</h2>
            <p class="hint small">Sessions de charge récentes</p>
          </div>
        </div>
        @if (stationCounts().length) {
          <div class="station-chart">
            @for (station of stationCounts(); track station.name) {
              <div class="station-row">
                <div class="station-row-heading">
                  <b>{{ station.name }}</b>
                  <span>{{ station.total }} décision{{ station.total === 1 ? '' : 's' }}</span>
                </div>
                <div class="station-bar" role="img"
                     [attr.aria-label]="station.name + ': ' + station.ALLOW + ' ALLOW, ' + station.MFA + ' MFA, ' + station.DENY + ' DENY'">
                  @if (station.ALLOW) { <span class="station-allow" [style.width.%]="stationPercent(station.ALLOW, station.total)"></span> }
                  @if (station.MFA) { <span class="station-mfa" [style.width.%]="stationPercent(station.MFA, station.total)"></span> }
                  @if (station.DENY) { <span class="station-deny" [style.width.%]="stationPercent(station.DENY, station.total)"></span> }
                </div>
              </div>
            }
          </div>
          <div class="chart-legend">
            <span><i class="legend-dot allow-dot"></i>ALLOW</span>
            <span><i class="legend-dot mfa-dot"></i>MFA</span>
            <span><i class="legend-dot deny-dot"></i>DENY</span>
          </div>
        } @else {
          <p class="empty-chart">Aucune session de charge à afficher.</p>
        }
      </article>
    </section>

    <section>
      <div class="section-head">
        <h2>Journal blockchain (AuditLog)</h2>
        <button class="secondary small" (click)="refresh()">Actualiser</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Décision</th><th>Raison</th><th>Risque</th><th>Preuve</th><th></th></tr></thead>
          <tbody>
            @for (e of audit(); track e.request_id) {
              <tr>
                <td>{{ e.index }}</td>
                <td>{{ e.timestamp * 1000 | date: 'dd/MM HH:mm:ss' }}</td>
                <td><span class="badge" [class]="e.decision.toLowerCase()">{{ e.decision }}</span></td>
                <td>{{ reason(e.reason) }}</td>
                <td>{{ e.risk }}</td>
                <td><code>{{ hash(e.evidence_hash) }}</code></td>
                <td>
                  @if (checks()[e.request_id]; as c) {
                    <span class="badge" [class]="c.integrity_ok ? 'allow' : 'deny'">
                      {{ c.integrity_ok ? 'Intègre' : 'ALTÉRÉ' }}
                    </span>
                  } @else {
                    <button class="secondary small" (click)="verify(e.request_id)">Vérifier</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty">Journal vide.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Dernières sessions de charge</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Borne</th><th>Décision</th><th>Risque</th><th>Statut</th></tr></thead>
          <tbody>
            @for (s of sessions(); track s.id) {
              <tr>
                <td>{{ s.startedAt | date: 'dd/MM HH:mm:ss' }}</td>
                <td>{{ s.username }}</td>
                <td>{{ s.stationName }}</td>
                <td><span class="badge" [class]="(s.decision ?? '').toLowerCase()">{{ s.decision }}</span></td>
                <td>{{ s.finalRisk ?? '-' }}</td>
                <td>{{ s.status }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">Aucune session.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .charts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .chart-card {
      min-width: 0;
      padding: 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .station-chart-card { grid-column: 1 / -1; }
    .chart-heading h2 { margin: 0; font-size: 1rem; }
    .chart-heading p { margin: 0.35rem 0 0; }
    .timeline-chart { display: block; width: 100%; margin-top: 1rem; overflow: visible; }
    .grid-line { stroke: var(--border); stroke-dasharray: 3 4; }
    .axis-label { fill: var(--muted); font-size: 11px; }
    .series-line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .allow-line { stroke: var(--ok); }
    .mfa-line { stroke: #f9a825; }
    .deny-line { stroke: var(--ko); }
    .allow-dot { background: var(--ok); fill: var(--ok); }
    .mfa-dot { background: #f9a825; fill: #f9a825; }
    .deny-dot { background: var(--ko); fill: var(--ko); }
    .chart-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem; color: var(--muted); font-size: 0.75rem; }
    .chart-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
    .legend-dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; }
    .risk-chart { display: flex; align-items: stretch; justify-content: space-around; gap: 0.5rem; height: 190px; margin-top: 0.75rem; }
    .risk-column { display: flex; min-width: 0; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: 0.35rem; }
    .risk-count { color: var(--muted); font-size: 0.75rem; }
    .risk-bar-track { display: flex; width: min(42px, 72%); height: 135px; align-items: flex-end; overflow: hidden; border-radius: 6px 6px 0 0; background: var(--bg); }
    .risk-bar { width: 100%; min-height: 0; border-radius: 5px 5px 0 0; background: var(--accent); transition: height 0.2s ease; }
    .risk-label { color: var(--muted); font-size: 0.7rem; white-space: nowrap; }
    .station-chart { display: grid; gap: 1rem; margin-top: 1rem; }
    .station-row-heading { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.85rem; }
    .station-row-heading span { color: var(--muted); }
    .station-bar { display: flex; height: 14px; overflow: hidden; border-radius: 999px; background: var(--bg); }
    .station-bar span { height: 100%; transition: width 0.2s ease; }
    .station-allow { background: var(--ok); }
    .station-mfa { background: #f9a825; }
    .station-deny { background: var(--ko); }
    .empty-chart { display: grid; min-height: 150px; place-items: center; color: var(--muted); font-size: 0.875rem; }
    @media (max-width: 760px) {
      .charts { grid-template-columns: minmax(0, 1fr); }
      .station-chart-card { grid-column: auto; }
      .chart-card { padding: 1rem; }
    }
  `],
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly overview = signal<Overview | null>(null);
  protected readonly audit = signal<AuditEntry[]>([]);
  protected readonly sessions = signal<ChargeSession[]>([]);
  protected readonly checks = signal<Record<string, IntegrityResult>>({});
  protected readonly error = signal('');
  protected readonly reason = reasonText;
  protected readonly hash = (h: string) => shortHash(h, 6);
  protected readonly timeline = computed(() => {
    const interval = 10 * 60 * 1000;
    const latest = Math.floor(Date.now() / interval) * interval;
    const start = latest - 11 * interval;
    const points = Array.from({ length: 12 }, (_, index): TimelinePoint => {
      const timestamp = start + index * interval;
      return {
        timestamp,
        label: new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(timestamp),
        ALLOW: 0,
        MFA: 0,
        DENY: 0,
      };
    });

    for (const entry of this.audit()) {
      const index = Math.floor((entry.timestamp * 1000 - start) / interval);
      if (index >= 0 && index < points.length) points[index][entry.decision] += 1;
    }
    return points;
  });
  protected readonly timelineLabels = computed(() =>
    this.timeline().filter((_, index) => index % 3 === 0 || index === 11),
  );
  protected readonly timelineTicks = computed(() => {
    const max = Math.max(1, ...this.timeline().map((point) => point.ALLOW + point.MFA + point.DENY));
    return [...new Set([0, Math.ceil(max / 2), max])].map((value) => ({ value }));
  });
  protected readonly riskBuckets = computed<RiskBucket[]>(() => {
    const buckets: RiskBucket[] = [
      { label: '0–19', count: 0 },
      { label: '20–39', count: 0 },
      { label: '40–59', count: 0 },
      { label: '60–79', count: 0 },
      { label: '80–100', count: 0 },
    ];
    for (const entry of this.audit()) {
      const index = Math.max(0, Math.min(4, Math.floor(entry.risk / 20)));
      buckets[index].count += 1;
    }
    return buckets;
  });
  protected readonly maxRiskCount = computed(() => Math.max(1, ...this.riskBuckets().map((bucket) => bucket.count)));
  protected readonly stationCounts = computed<StationDecisionCount[]>(() => {
    const grouped = new Map<string, Record<DecisionSeries, number>>();
    for (const session of this.sessions()) {
      if (!session.decision) continue;
      const counts = grouped.get(session.stationName) ?? { ALLOW: 0, MFA: 0, DENY: 0 };
      counts[session.decision] += 1;
      grouped.set(session.stationName, counts);
    }
    return [...grouped.entries()]
      .map(([name, counts]) => ({
        name,
        ...counts,
        total: counts.ALLOW + counts.MFA + counts.DENY,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });
  private timer?: ReturnType<typeof setInterval>;

  protected timelineX(timestamp: number): number {
    const start = this.timeline()[0]?.timestamp ?? timestamp;
    return 42 + ((timestamp - start) / (11 * 10 * 60 * 1000)) * 588;
  }

  protected timelineY(count: number): number {
    const max = Math.max(1, ...this.timeline().map((point) => point.ALLOW + point.MFA + point.DENY));
    return 195 - (count / max) * 160;
  }

  protected linePoints(decision: DecisionSeries): string {
    return this.timeline()
      .map((point) => `${this.timelineX(point.timestamp)},${this.timelineY(point[decision])}`)
      .join(' ');
  }

  protected barHeight(count: number, max: number): number {
    return count === 0 ? 0 : Math.max(4, (count / max) * 100);
  }

  protected stationPercent(count: number, total: number): number {
    return total === 0 ? 0 : (count / total) * 100;
  }

  ngOnInit(): void {
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), 3_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected async refresh(): Promise<void> {
    try {
      const [overview, audit, sessions] = await Promise.all([
        this.api.overview(),
        this.api.audit(50),
        this.api.allSessions(),
      ]);
      this.overview.set(overview);
      this.audit.set(audit.entries);
      this.sessions.set(sessions);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async verify(requestId: string): Promise<void> {
    try {
      const result = await this.api.integrity(requestId);
      this.checks.update((c) => ({ ...c, [requestId]: result }));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
