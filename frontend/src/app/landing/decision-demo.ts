import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

type Device = 'known' | 'unknown';
type Place = 'lyon' | 'paris' | 'marseille';
type Traffic = 'normal' | 'scan' | 'dos';
type Account = 'active' | 'revoked';
type Verdict = 'ALLOW' | 'MFA' | 'DENY';

interface Option<T> {
  value: T;
  label: string;
}

/** Seuils de la politique "charge:start" déployée dans le smart contract AccessPolicy. */
const MFA_THRESHOLD = 30;
const DENY_THRESHOLD = 60;
/** Score de l'IA (illustratif) selon le type de trafic observé. */
const AI_RISK: Record<Traffic, number> = { normal: 8, scan: 72, dos: 95 };

/** Simulateur pédagogique du moteur de décision : reproduit les règles de l'API, sans appel serveur. */
@Component({
  selector: 'app-decision-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './decision-demo.html',
  styleUrl: './decision-demo.css',
})
export class DecisionDemo {
  protected readonly devices: Option<Device>[] = [
    { value: 'known', label: 'Téléphone habituel' },
    { value: 'unknown', label: 'Appareil inconnu' },
  ];
  protected readonly places: Option<Place>[] = [
    { value: 'lyon', label: 'Lyon (habituel)' },
    { value: 'paris', label: 'Paris' },
    { value: 'marseille', label: 'Marseille, 2 min après Lyon' },
  ];
  protected readonly traffics: Option<Traffic>[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'scan', label: 'Scan de ports' },
    { value: 'dos', label: 'Attaque DoS' },
  ];
  protected readonly accounts: Option<Account>[] = [
    { value: 'active', label: 'Actif' },
    { value: 'revoked', label: 'Révoqué' },
  ];

  protected readonly device = signal<Device>('known');
  protected readonly place = signal<Place>('lyon');
  protected readonly traffic = signal<Traffic>('normal');
  protected readonly account = signal<Account>('active');

  protected readonly aiRisk = computed(() => AI_RISK[this.traffic()]);

  protected readonly contributions = computed(() => {
    const items = [{ label: `Score de l'IA (trafic ${this.label(this.traffics, this.traffic()).toLowerCase()})`, points: this.aiRisk() }];
    if (this.place() !== 'lyon') items.push({ label: 'Zone inhabituelle', points: 25 });
    if (this.place() === 'marseille') items.push({ label: 'Voyage impossible (> 150 km/h)', points: 50 });
    return items;
  });

  protected readonly risk = computed(() => Math.min(100, this.contributions().reduce((sum, c) => sum + c.points, 0)));

  protected readonly result = computed<{ verdict: Verdict; title: string; reason: string }>(() => {
    const risk = this.risk();
    if (this.account() === 'revoked') {
      return { verdict: 'DENY', title: 'Accès refusé', reason: "Le compte est révoqué dans le registre d'identités on-chain." };
    }
    if (risk >= DENY_THRESHOLD) {
      return { verdict: 'DENY', title: 'Accès refusé', reason: `Risque ${risk}/100 : au-delà du seuil de refus (${DENY_THRESHOLD}).` };
    }
    if (risk >= MFA_THRESHOLD) {
      return { verdict: 'MFA', title: 'Vérification demandée', reason: `Risque ${risk}/100 : code à 6 chiffres exigé (seuil ${MFA_THRESHOLD}).` };
    }
    if (this.device() === 'unknown') {
      return { verdict: 'MFA', title: 'Vérification demandée', reason: 'Appareil non enregistré : code de l’application d’authentification exigé.' };
    }
    return { verdict: 'ALLOW', title: 'Charge autorisée', reason: `Risque ${risk}/100 : sous le seuil de vérification (${MFA_THRESHOLD}).` };
  });

  protected readonly steps = computed(() => {
    const revoked = this.account() === 'revoked';
    const verdict = this.result().verdict;
    return [
      { label: 'Identité', state: revoked ? 'ko' : 'ok' },
      { label: 'Risque IA', state: this.risk() >= DENY_THRESHOLD ? 'ko' : this.risk() >= MFA_THRESHOLD ? 'warn' : 'ok' },
      { label: 'Politique', state: verdict === 'ALLOW' ? 'ok' : verdict === 'MFA' ? 'warn' : 'ko' },
      { label: 'Preuve', state: 'ok' },
    ];
  });

  /** Valeur affichée, animée vers le risque courant. */
  protected readonly shown = signal(this.risk());

  constructor() {
    let frame = 0;
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(frame));
    effect(() => {
      const target = this.risk();
      const start = untracked(this.shown);
      const t0 = performance.now();
      cancelAnimationFrame(frame);
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 600);
        this.shown.set(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
  }

  protected label<T>(options: Option<T>[], value: T): string {
    return options.find((o) => o.value === value)?.label ?? '';
  }
}
