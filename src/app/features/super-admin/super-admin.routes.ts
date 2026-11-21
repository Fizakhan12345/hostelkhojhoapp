// features/super-admin/super-admin.routes.ts
// Add to app.routes.ts with ONE line:   ...SUPER_ADMIN_ROUTES,
import { Routes } from '@angular/router';
import { superAdminGuard } from '../../core/guards/super-admin.guard';
import { SaResourcePageData } from './shared/sa-resource-page';

const roomsPage: SaResourcePageData = {
  resource: 'rooms',
  title: 'Rooms',
  subtitle: 'Every room across all hostels, with availability',
  addLabel: 'Add Room',
  columns: ['id', 'property_name', 'property_city', 'room_type', 'capacity', 'available', 'total_beds', 'price_per_bed'],
};

const citiesPage: SaResourcePageData = {
  resource: 'cities',
  title: 'Cities',
  subtitle: 'Cities shown in the Cities menu and search',
  addLabel: 'Register City',
  columns: ['id', 'name', 'city_name', 'state', 'slug', 'is_active', 'is_popular'],
};

export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: 'super-admin/login',
    loadComponent: () => import('./login/super-admin-login').then((m) => m.SuperAdminLogin),
  },
  {
    path: 'super-admin',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./layout/super-admin-layout').then((m) => m.SuperAdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./overview/sa-overview').then((m) => m.SaOverview) },
      { path: 'users', loadComponent: () => import('./users/sa-users').then((m) => m.SaUsers) },
      { path: 'listings', loadComponent: () => import('./listings/sa-listings').then((m) => m.SaListings) },
      { path: 'owners', loadComponent: () => import('./owners/sa-owners').then((m) => m.SaOwners) },
      { path: 'plan-payments', loadComponent: () => import('./plan-payments/sa-plan-payments').then((m) => m.SaPlanPayments) },
      { path: 'rooms', data: roomsPage, loadComponent: () => import('./shared/sa-resource-page').then((m) => m.SaResourcePage) },
      { path: 'cities', data: citiesPage, loadComponent: () => import('./shared/sa-resource-page').then((m) => m.SaResourcePage) },
      { path: 'payments', loadComponent: () => import('./payments/sa-payments').then((m) => m.SaPayments) },
    ],
  },
];
