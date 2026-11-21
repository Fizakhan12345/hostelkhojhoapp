// features/owner/owner.routes.ts
// Add to app.routes.ts with one line:   ...OWNER_ROUTES,
import { Routes } from '@angular/router';
import { ownerGuard } from '../../core/guards/owner.guard';

export const OWNER_ROUTES: Routes = [
  {
    path: 'owner',
    canActivate: [ownerGuard],
    loadComponent: () => import('./layout/owner-layout').then((m) => m.OwnerLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./dashboard/owner-dashboard').then((m) => m.OwnerDashboard) },
      { path: 'add-property', loadComponent: () => import('./add-property/owner-add-property').then((m) => m.OwnerAddProperty) },
      { path: 'enquiries', loadComponent: () => import('./enquiries/owner-enquiries').then((m) => m.OwnerEnquiries) },
      { path: 'plans', loadComponent: () => import('./plans/owner-plans').then((m) => m.OwnerPlans) },
    ],
  },
];
