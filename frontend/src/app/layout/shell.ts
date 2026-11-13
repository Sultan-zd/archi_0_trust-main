import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth.service';
import { LpIcon } from '../landing/lp-icon';
import { BrandMark } from '../shared/brand-mark';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const ROLE_LABELS: Record<string, string> = { User: 'Conducteur', Fleet: 'Gestionnaire de flotte', Admin: 'Administrateur' };

/** Espace privé (utilisateur connecté) : barre latérale (repliable sur mobile) + page courante. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandMark, LpIcon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: { class: 'app-shell' },
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);

  protected readonly roleLabel = computed(() => ROLE_LABELS[this.auth.role() ?? ''] ?? 'Sans rôle');
  protected readonly initial = computed(() => (this.auth.username() || '?').charAt(0).toUpperCase());

  protected readonly nav = computed<NavItem[]>(() => {
    const mfa: NavItem = { path: '/mfa', label: 'Sécurité (MFA)', icon: 'qr' };
    switch (this.auth.role()) {
      case 'Admin':
        return [
          { path: '/admin', label: 'Supervision', icon: 'chart', exact: true },
          { path: '/stations', label: 'Bornes', icon: 'station' },
          { path: '/resources', label: 'Politiques d’accès', icon: 'layers' },
          { path: '/admin/users', label: 'Utilisateurs', icon: 'users' },
          mfa,
        ];
      case 'Fleet':
        return [
          { path: '/fleet', label: 'Espace flotte', icon: 'fleet' },
          { path: '/stations', label: 'Recharger', icon: 'bolt' },
          { path: '/history', label: 'Historique', icon: 'clock' },
          mfa,
        ];
      default:
        return [
          { path: '/stations', label: 'Recharger', icon: 'bolt' },
          { path: '/history', label: 'Historique', icon: 'clock' },
          mfa,
        ];
    }
  });

  constructor() {
    // Ferme le menu mobile après chaque navigation.
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
  }

  protected logout(): void {
    this.auth.logout();
  }
}
