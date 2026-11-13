import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Decision } from '../models';
import { copyText, reasonText, shortHash } from '../util';

@Component({
  selector: 'app-decision-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = decision();
    <div class="decision" [class]="'decision ' + d.decision.toLowerCase()">
      <div class="verdict">
        <span class="badge" [class]="d.decision.toLowerCase()">{{ d.decision }}</span>
        <strong>{{ explanation() }}</strong>
      </div>

      <!-- Détails utiles pour l'utilisateur -->
      <div class="meta">
        <span>Appareil : <b>{{ d.trustedDevice ? 'de confiance' : 'inconnu' }}</b></span>
        @if (d.role) { <span>Rôle : <b>{{ d.role }}</b></span> }
        @if (d.mfaPassed !== null) { <span>MFA : <b>{{ d.mfaPassed ? 'validé' : 'échec' }}</b></span> }
        <span>Niveau de risque : <b>{{ riskLabel() }}</b></span>
      </div>

      <!-- Raisons contextuelles (traduites) -->
      @if (d.contextReasons.length) {
        <ul class="reasons">
          @for (why of d.contextReasons; track why) {
            <li>{{ why }}</li>
          }
        </ul>
      }

      <!-- Détails techniques : admin seulement -->
      @if (mode() === 'admin') {
        <div class="risk">
          <div class="risk-row">
            <span>Risque final</span>
            <div class="bar"><div [style.width.%]="d.finalRisk" [class]="level()"></div></div>
            <b>{{ d.finalRisk }}/100</b>
          </div>
          <div class="risk-detail">
            IA : <b>{{ d.aiRisk }}</b> &nbsp;+&nbsp; contexte : <b>{{ d.contextRisk }}</b>
            @if (d.predictedClass) { &nbsp;·&nbsp; classe prédite : <b>{{ d.predictedClass }}</b> }
          </div>
        </div>

        @if (components().length) {
          <details>
            <summary>Scores des modèles IA</summary>
            <ul class="components">
              @for (c of components(); track c[0]) {
                <li><span>{{ c[0] }}</span><b>{{ c[1] }}</b></li>
              }
            </ul>
          </details>
        }

        <div class="proof">
          Preuve : <code>{{ hash() }}</code>
          <button class="secondary small" type="button" (click)="copy()">{{ copied() ? 'Copié' : 'Copier' }}</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .reasons { margin: 0.5rem 0; padding-left: 1.25rem; color: var(--muted); font-size: 0.875rem; }
    .reasons li { margin-bottom: 0.25rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; color: var(--muted); margin: 0.5rem 0; }
  `]
})
export class DecisionCard {
  readonly decision = input.required<Decision>();
  readonly mode = input<'user' | 'admin'>('user');
  protected readonly copied = signal(false);

  protected readonly explanation = computed(() => {
    const d = this.decision();
    if (d.decision === 'ALLOW' && d.mfaPassed === true) return 'Vérification réussie. Accès autorisé.';
    if (d.decision === 'ALLOW') return 'Accès autorisé. Vous pouvez recharger votre véhicule.';
    if (d.decision === 'MFA') return 'Vérification supplémentaire requise. Saisissez le code de votre application.';
    if (d.reason === 'RISK_DENY') return 'Accès refusé en raison d\'un risque de sécurité élevé.';
    if (d.reason === 'USER_REVOKED') return 'Accès refusé : votre compte a été révoqué.';
    if (d.reason === 'ROLE_TOO_LOW') return 'Accès refusé : vous n\'avez pas les droits nécessaires.';
    if (d.reason === 'OUTSIDE_HOURS') return 'Accès refusé : cette ressource n\'est pas accessible à cette heure.';
    if (d.reason === 'DEVICE_UNTRUSTED') return 'Accès refusé : cet appareil n\'est pas reconnu.';
    return 'Accès refusé. ' + reasonText(d.reason);
  });

  protected readonly riskLabel = computed(() => {
    const risk = this.decision().finalRisk;
    if (risk < 30) return 'Faible';
    if (risk < 60) return 'Modéré';
    return 'Élevé';
  });

  protected readonly hash = computed(() => shortHash(this.decision().evidenceHash));
  protected readonly level = computed(() => ({ ALLOW: 'low', MFA: 'mid', DENY: 'high' })[this.decision().decision] ?? 'low');
  protected readonly components = computed(() =>
    Object.entries(this.decision().components ?? {}).map(([k, v]) => [k, typeof v === 'number' ? v.toFixed(2) : String(v)]),
  );

  protected async copy(): Promise<void> {
    if (await copyText(this.decision().evidenceHash)) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    }
  }
}
