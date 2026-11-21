import { Routes } from '@angular/router';
import { CityDetailComponent } from './features/cities-view/city-detail.component';
import { CitiesListComponent } from './features/cities-list/cities-list.component';
import { FindHostelComponent } from './features/property-search/find-hostel';
import { PropertyDetail } from './features/property-detail/property-detail';
import { Booking } from './features/booking/booking';
import { Profile } from './features/profile/profile';
import { SUPER_ADMIN_ROUTES } from './features/super-admin/super-admin.routes';   // ⬅ added
import { OWNER_ROUTES } from './features/owner/owner.routes';
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },

  // ── Super admin panel (/super-admin/login, /super-admin/overview, ...) ──
  ...SUPER_ADMIN_ROUTES,      
    ...OWNER_ROUTES,                                                   // ⬅ added

  { path: 'profile', component: Profile },
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then(m => m.Home)
  },
  { path: 'properties/:id', component: PropertyDetail },
  { path: 'booking/:propertyId', component: Booking },
  {
    path: 'properties',
    loadComponent: () => import('./features/properties/properties').then(m => m.Properties)
  },
  { path: 'cities', component: CitiesListComponent },
  { path: 'cities/:slug', component: CityDetailComponent },
  { path: 'find-hostel', component: FindHostelComponent },
  {
    path: 'register-your-hostel',
    loadComponent: () => import('./features/admin-registraion/admin-auth.component')
      .then(m => m.AdminAuthComponent)
  },
  { path: 'settings', loadComponent: () => import('./features/settings/settings').then(m => m.Settings) },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'contact',
    loadComponent: () => import('./features/Contact/contact').then(m => m.Contact)
  },
  {
    path: 'services',
    loadComponent: () => import('./features/OurServices/ourservices').then(m => m.OurServicesComponent)
  },
  {
    path: 'help',
    loadComponent: () => import('./features/Help/help').then(m => m.HelpComponent)
  },
  { path: 'favorites', loadComponent: () => import('./features/favorites/favorites').then(m => m.Favorites) },
  { path: 'bookings',  loadComponent: () => import('./features/my-bookings/my-bookings').then(m => m.MyBookings) },

  // must stay LAST
  {
    path: '**',
    redirectTo: 'home'
  }
];