// core/guards/super-admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SuperAdminService } from '../services/super-admin.service';

export const superAdminGuard: CanActivateFn = () => {
  const sa = inject(SuperAdminService);
  const router = inject(Router);

  // No storage during server-side rendering — the browser decides
  if (!sa.isBrowser) return true;

  return sa.isLoggedIn() ? true : router.createUrlTree([SUPER_ADMIN_LOGIN_ROUTE]);
};
