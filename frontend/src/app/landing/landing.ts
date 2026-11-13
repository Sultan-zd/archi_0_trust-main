import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { BrandMark } from '../shared/brand-mark';
import { DecisionDemo } from './decision-demo';
import { HeroScene } from './hero-scene';
import { LpIcon } from './lp-icon';
import { RevealDirective } from './reveal.directive';

interface Feature {
  icon: string;
  title: string;
  text: string;
  wide?: boolean;
}

/** Page d'accueil publique : présentation du produit, simulateur de décision et accès à la plateforme. */
@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandMark, HeroScene, DecisionDemo, RevealDirective, LpIcon],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  host: { class: 'lp', '(window:scroll)': 'onScroll()' },
})
export class LandingPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected readonly nav = [
    { id: 'fonctionnement', label: 'Fonctionnement' },
    { id: 'simulateur', label: 'Simulateur' },
    { id: 'securite', label: 'Sécurité' },
    { id: 'espaces', label: 'Espaces' },
    { id: 'faq', label: 'FAQ' },
  ];

  protected readonly pipeline = [
    {
      n: '01', title: 'Identité', tag: 'Keycloak · OpenID Connect',
      text: 'Connexion par jeton signé, rôles Conducteur, Flotte ou Admin, et MFA par application d’authentification.',
    },
    {
      n: '02', title: 'Risque IA', tag: '3 modèles fusionnés',
      text: 'Forêt aléatoire, Isolation Forest et autoencodeur évaluent le trafic ; le contexte (lieu, appareil, historique) s’ajoute.',
    },
    {
      n: '03', title: 'Politique on-chain', tag: 'Smart contract AccessPolicy',
      text: 'Rôle minimal, plage horaire, appareil de confiance et seuils de risque décident : ALLOW, MFA ou DENY.',
    },
    {
      n: '04', title: 'Preuve', tag: 'SHA-256 · AuditLog',
      text: 'Chaque décision est ancrée sur la blockchain. Son intégrité se vérifie à tout moment, ligne par ligne.',
    },
  ];

  protected readonly features: Feature[] = [
    {
      icon: 'radar', wide: true, title: 'Détection d’attaque en temps réel',
      text: 'Le trafic réseau est surveillé en continu. Pendant un flood SYN ou un scan, les demandes sont refusées automatiquement et une alerte s’affiche en supervision.',
    },
    {
      icon: 'qr', title: 'MFA par QR code',
      text: 'Google ou Microsoft Authenticator. Le secret n’est montré qu’au titulaire du compte, une seule fois — jamais à l’administrateur.',
    },
    {
      icon: 'replay', title: 'Anti-rejeu',
      text: 'Chaque requête porte un identifiant unique et n’est valable que 30 secondes. Une requête copiée est rejetée.',
    },
    {
      icon: 'route', title: 'Voyage impossible',
      text: 'Lyon puis Marseille en deux minutes ? Le déplacement dépasse 150 km/h : le risque grimpe et l’accès est refusé.',
    },
    {
      icon: 'layers', title: 'Micro-segmentation',
      text: 'Recharge, facturation, flotte, firmware : chaque ressource a sa propre politique et ses propres seuils.',
    },
    {
      icon: 'ledger', wide: true, title: 'Journal infalsifiable',
      text: 'L’empreinte de chaque décision est inscrite dans un smart contract. Modifier le journal après coup est détectable immédiatement.',
    },
    {
      icon: 'shield', title: 'Révocation instantanée',
      text: 'Un compte révoqué sur la blockchain perd immédiatement tous ses accès, y compris ses sessions de charge ouvertes.',
    },
  ];

  protected readonly spaces = [
    {
      role: 'Conducteur', icon: 'car',
      text: 'Recharger en quelques secondes, en toute sécurité.',
      points: ['Démarrage et arrêt de charge', 'Historique et preuves de chaque session', 'MFA sur son propre téléphone'],
    },
    {
      role: 'Gestionnaire de flotte', icon: 'fleet', featured: true,
      text: 'Piloter les recharges de plusieurs véhicules.',
      points: ['Vue d’ensemble de la flotte', 'Accès au tableau de bord flotte', 'Décisions et risques par véhicule'],
    },
    {
      role: 'Administrateur', icon: 'shield',
      text: 'Superviser, auditer et réagir.',
      points: ['Supervision en direct et alertes', 'Vérification d’intégrité du journal', 'Gestion et révocation des comptes'],
    },
  ];

  protected readonly stats = [
    { value: '4', label: 'contrôles à chaque demande' },
    { value: '3', label: 'modèles d’IA fusionnés' },
    { value: '30 s', label: 'de validité par requête' },
    { value: '100 %', label: 'des décisions journalisées' },
  ];

  protected readonly faq = [
    {
      q: 'Que signifie « Zero Trust » ?',
      a: 'Aucune demande n’est considérée comme sûre par défaut, même venant d’un utilisateur déjà connecté. Identité, contexte et risque sont vérifiés à chaque recharge.',
    },
    {
      q: 'Que se passe-t-il si une vérification MFA est demandée ?',
      a: 'L’application vous demande le code à 6 chiffres affiché par Google ou Microsoft Authenticator. Une fois validé, la charge démarre. La MFA s’active en scannant un QR code depuis votre espace.',
    },
    {
      q: 'Pourquoi une blockchain ?',
      a: 'Les politiques d’accès et le journal des décisions sont stockés dans des smart contracts. Personne, pas même un administrateur, ne peut modifier une décision passée sans que cela se voie.',
    },
    {
      q: 'L’IA peut-elle bloquer un conducteur légitime ?',
      a: 'Un risque modéré déclenche une vérification par code plutôt qu’un refus. Seul un risque élevé (attaque, déplacement impossible) entraîne un refus, toujours expliqué et journalisé.',
    },
    {
      q: 'Mes données sont-elles visibles par l’administrateur ?',
      a: 'L’administrateur voit les décisions et l’état des bornes, mais jamais votre mot de passe ni votre secret MFA.',
    },
  ];

  ngOnInit(): void {
    void this.auth.whenReady();
    this.onScroll();
  }

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  protected go(id: string, event?: Event): void {
    event?.preventDefault();
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected signIn(): void {
    void this.auth.login('/stations');
  }

  protected enter(): void {
    if (this.auth.authenticated()) void this.router.navigateByUrl('/stations');
    else void this.auth.login('/stations');
  }
}
