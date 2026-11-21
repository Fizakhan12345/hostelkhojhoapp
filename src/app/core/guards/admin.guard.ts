// core/guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../services/admin-auth.service';

export const adminGuard: CanActivateFn = () => {
  const admin = inject(AdminAuthService);
  const router = inject(Router);

  // During server-side rendering there's no storage — let the browser decide
  if (!admin.isBrowser) return true;

  return admin.isLoggedIn() ? true : router.createUrlTree([ADMIN_LOGIN_ROUTE]);
};
