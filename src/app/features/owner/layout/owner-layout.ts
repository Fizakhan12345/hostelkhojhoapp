// features/owner/layout/owner-layout.ts  →  /owner (parent of all owner pages)
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../../../core/services/admin-auth.service';

@Component({
  selector: 'app-owner-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  styleUrls: ['../shared/owner-theme.css'],
  template: `
    <div class="owner-shell">
      <header class="band">
        <div class="wrap band-inner">
          <div class="who">
            <span class="badge">{{ initial }}</span>
            <div>
              <p class="hello">{{ auth.currentAdmin()?.name || 'Owner' }}</p>
              <p class="role">Property owner</p>
            </div>
          </div>

          <nav aria-label="Owner sections">
            <a routerLink="dashboard" routerLinkActive="active">My properties</a>
            <a routerLink="add-property" routerLinkActive="active">Add property</a>
            <a routerLink="enquiries" routerLinkActive="active">Enquiries</a>
            <a routerLink="plans" routerLinkActive="active">Plan &amp; billing</a>
          </nav>

          <button type="button" class="logout" (click)="logout()">Log out</button>
        </div>
      </header>

      <main class="wrap content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .owner-shell { min-height: 100vh; padding-top: 68px; background: var(--paper); }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 0 1.25rem; }

    .band { background: linear-gradient(180deg, var(--night), var(--dusk)); color: var(--mist); }
    .band-inner { display: flex; align-items: center; gap: 1.5rem; padding-top: 1rem; padding-bottom: 1rem; flex-wrap: wrap; }

    .who { display: flex; align-items: center; gap: 0.75rem; }
    .badge {
      width: 42px; height: 42px; border-radius: 10px;
      background: var(--amber); color: var(--night);
      display: grid; place-items: center;
      font-family: 'Bricolage Grotesque', sans-serif; font-weight: 800; font-size: 1.2rem;
      box-shadow: 0 0 18px rgba(255, 181, 71, 0.45);
    }
    .hello { margin: 0; color: #fff; font-weight: 700; }
    .role { margin: 0; font-size: 0.82rem; opacity: 0.8; }

    nav { display: flex; gap: 0.25rem; margin-left: auto; flex-wrap: wrap; }
    nav a {
      padding: 0.55rem 0.9rem; border-radius: 8px;
      color: var(--mist); text-decoration: none; font-weight: 600; font-size: 0.92rem;
    }
    nav a:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
    nav a.active { color: var(--night); background: var(--amber); }
    nav a:focus-visible, .logout:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }

    .logout {
      padding: 0.5rem 0.9rem; border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.25); background: transparent; color: #fff;
      font: inherit; font-weight: 600; font-size: 0.88rem; cursor: pointer;
    }
    .logout:hover { border-color: #fff; }

    .content { padding-top: 2rem; padding-bottom: 3rem; }

    @media (max-width: 760px) {
      nav { margin-left: 0; width: 100%; overflow-x: auto; flex-wrap: nowrap; }
      nav a { white-space: nowrap; }
      .logout { margin-left: auto; }
    }
  `],
})
export class OwnerLayout {
  auth = inject(AdminAuthService);
  private router = inject(Router);

  get initial(): string {
    return (this.auth.currentAdmin()?.name || 'O').charAt(0).toUpperCase();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate([ADMIN_LOGIN_ROUTE], { queryParams: { tab: 'login' } });
  }
}
