// features/super-admin/layout/super-admin-layout.ts  →  route: /super-admin (parent of all panel pages)
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SuperAdminService } from '../../../core/services/super-admin.service';

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="sa-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-icon">🛡️</span>
          <div>
            <p class="brand-name">Super Admin</p>
            <p class="brand-sub">HostelKhojo</p>
          </div>
        </div>

        <nav>
          <a *ngFor="let item of nav" [routerLink]="item.path" routerLinkActive="active" class="nav-link">
            <span class="nav-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        </nav>

        <div class="me">
          <div class="me-avatar">{{ (sa.currentAdmin()?.name || 'S').charAt(0) }}</div>
          <div class="me-info">
            <p class="me-name">{{ sa.currentAdmin()?.name || 'Super Admin' }}</p>
            <p class="me-email">{{ sa.currentAdmin()?.email }}</p>
          </div>
          <button class="logout" (click)="logout()" title="Log out">⎋</button>
        </div>
      </aside>

      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
    :host { display: block; font-family: 'DM Sans', sans-serif; }
    .sa-shell { display: flex; min-height: 100vh; padding-top: 68px; background: #f7f5f0; }

    .sidebar {
      width: 250px; flex-shrink: 0; position: sticky; top: 68px; height: calc(100vh - 68px);
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%); color: #fff;
      display: flex; flex-direction: column; padding: 1.25rem .9rem;
    }
    .brand { display: flex; align-items: center; gap: .7rem; padding: 0 .4rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,.1); }
    .brand-icon { font-size: 1.5rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                  background: rgba(246,201,14,.12); border-radius: 10px; }
    .brand-name { margin: 0; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1rem; }
    .brand-sub { margin: 0; font-size: .72rem; color: #90adc4; letter-spacing: .5px; text-transform: uppercase; }

    nav { display: flex; flex-direction: column; gap: .25rem; margin-top: 1rem; flex: 1; }
    .nav-link {
      display: flex; align-items: center; gap: .7rem; padding: .7rem .8rem; border-radius: 10px;
      color: #cbd5e1; text-decoration: none; font-weight: 600; font-size: .9rem; transition: background .15s, color .15s;
    }
    .nav-link:hover { background: rgba(255,255,255,.06); color: #fff; }
    .nav-link.active { background: rgba(246,201,14,.14); color: #f6c90e; }
    .nav-icon { width: 22px; text-align: center; }

    .me { display: flex; align-items: center; gap: .6rem; padding: .9rem .4rem 0; border-top: 1px solid rgba(255,255,255,.1); }
    .me-avatar { width: 36px; height: 36px; border-radius: 50%; background: #f6c90e; color: #1a1a2e;
                 display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
    .me-info { min-width: 0; flex: 1; }
    .me-name { margin: 0; font-weight: 700; font-size: .85rem; }
    .me-email { margin: 0; font-size: .72rem; color: #90adc4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .logout { border: 1px solid rgba(255,255,255,.2); background: transparent; color: #fff; border-radius: 8px;
              width: 34px; height: 34px; cursor: pointer; font-size: 1rem; }
    .logout:hover { background: rgba(239,68,68,.25); border-color: #ef4444; }

    .content { flex: 1; min-width: 0; padding: 1.75rem; }

    @media (max-width: 860px) {
      .sa-shell { flex-direction: column; }
      .sidebar { width: auto; height: auto; position: static; flex-direction: row; align-items: center; gap: .5rem; padding: .6rem; overflow-x: auto; }
      .brand, .me-info, .me-avatar { display: none; }
      nav { flex-direction: row; margin: 0; }
      .nav-link { white-space: nowrap; padding: .55rem .75rem; }
      .me { border: none; padding: 0; }
      .content { padding: 1.1rem; }
    }
  `],
})
export class SuperAdminLayout {
  sa = inject(SuperAdminService);
  private router = inject(Router);

  nav = [
    { path: 'overview', label: 'Overview', icon: '📊' },
    { path: 'users', label: 'Users', icon: '👥' },
    { path: 'listings', label: 'Listings', icon: '🏠' },
    { path: 'owners', label: 'Owners & enquiries', icon: '📨' },
    { path: 'plan-payments', label: 'Plan payments', icon: '💰' },
    { path: 'rooms', label: 'Rooms', icon: '🛏️' },
    { path: 'cities', label: 'Cities', icon: '🌆' },
    { path: 'payments', label: 'Payments', icon: '💳' },
  ];

  logout(): void {
    this.sa.logout();
    this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
  }
}
