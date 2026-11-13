import { Routes } from '@angular/router';
import { roleGuard } from './role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'stations' },
  {
    path: 'stations',
    title: 'Bornes',
    loadComponent: () => import('./pages/stations').then((m) => m.StationsPage),
  },
  {
    path: 'history',
    title: 'Historique',
    loadComponent: () => import('./pages/history').then((m) => m.HistoryPage),
  },
  {
    path: 'mfa',
    title: 'Activer la MFA',
    loadComponent: () => import('./pages/mfa').then((m) => m.MfaPage),
  },
  {
    path: 'resources',
    title: 'Micro-segments',
    canActivate: [roleGuard('Admin')], // Réservé aux admins
    loadComponent: () => import('./pages/resources').then((m) => m.ResourcesPage),
  },
  {
    path: 'fleet',
    title: 'Gestion de flotte',
    canActivate: [roleGuard('Fleet')],
    loadComponent: () => import('./pages/fleet-dashboard').then((m) => m.FleetDashboardPage),
  },
  {
    path: 'admin',
    title: 'Supervision',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/admin-dashboard').then((m) => m.AdminDashboardPage),
  },
  {
    path: 'admin/users',
    title: 'Utilisateurs',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/admin-users').then((m) => m.AdminUsersPage),
  },
  { path: '**', redirectTo: 'stations' },
];
