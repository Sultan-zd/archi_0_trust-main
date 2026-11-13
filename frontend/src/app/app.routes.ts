import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

export const routes: Routes = [
  // Page d'accueil publique.
  {
    path: '',
    pathMatch: 'full',
    title: 'AI-ZTB — La recharge électrique Zero Trust',
    loadComponent: () => import('./landing/landing').then((m) => m.LandingPage),
  },

  {
    path: 'inscription',
    title: 'Créer un compte · AI-ZTB',
    loadComponent: () => import('./public/register').then((m) => m.RegisterPage),
  },

  // Espace privé : connexion Keycloak obligatoire, barre latérale commune.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'stations',
        title: 'Bornes · AI-ZTB',
        loadComponent: () => import('./pages/stations').then((m) => m.StationsPage),
      },
      {
        path: 'history',
        title: 'Historique · AI-ZTB',
        loadComponent: () => import('./pages/history').then((m) => m.HistoryPage),
      },
      {
        path: 'mfa',
        title: 'Activer la MFA · AI-ZTB',
        loadComponent: () => import('./pages/mfa').then((m) => m.MfaPage),
      },
      {
        path: 'resources',
        title: 'Micro-segments · AI-ZTB',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./pages/resources').then((m) => m.ResourcesPage),
      },
      {
        path: 'fleet',
        title: 'Gestion de flotte · AI-ZTB',
        canActivate: [roleGuard('Fleet')],
        loadComponent: () => import('./pages/fleet-dashboard').then((m) => m.FleetDashboardPage),
      },
      {
        path: 'admin',
        title: 'Supervision · AI-ZTB',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./pages/admin-dashboard').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'admin/users',
        title: 'Utilisateurs · AI-ZTB',
        canActivate: [roleGuard('Admin')],
        loadComponent: () => import('./pages/admin-users').then((m) => m.AdminUsersPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
