// core/guards/owner.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../services/admin-auth.service';

export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (!auth.isBrowser) return true; // server render: let the browser decide
  return auth.isLoggedIn() ? true : router.createUrlTree([ADMIN_LOGIN_ROUTE]);
};
