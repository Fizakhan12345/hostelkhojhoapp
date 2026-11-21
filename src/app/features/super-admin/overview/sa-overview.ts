// features/super-admin/overview/sa-overview.ts  →  route: /super-admin/overview
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SaStats, SuperAdminService } from '../../../core/services/super-admin.service';

@Component({
  selector: 'app-sa-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Welcome, {{ sa.currentAdmin()?.name || 'Super Admin' }}</h1>
        <p>Everything happening on HostelKhojo at a glance.</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <p class="alert error" *ngIf="error()">⚠️ {{ error() }}</p>

    <div class="stat-grid" *ngIf="loading()">
      <div class="skeleton" *ngFor="let s of [1,2,3,4,5,6,7]" style="height: 86px"></div>
    </div>

    <div class="stat-grid" *ngIf="!loading() && stats() as s">
      <a class="stat link" routerLink="../users"><span class="stat-label">Users</span><span class="stat-num">{{ s.users ?? '—' }}</span></a>
      <a class="stat link" routerLink="../owners"><span class="stat-label">Hostel Owners</span><span class="stat-num">{{ s.admins ?? '—' }}</span></a>
      <a class="stat link" routerLink="../listings"><span class="stat-label">Properties</span><span class="stat-num">{{ s.properties ?? '—' }}</span></a>
      <a class="stat link pending" routerLink="../plan-payments" *ngIf="s.pendingPayments">
        <span class="stat-label">Payments to confirm</span><span class="stat-num">{{ s.pendingPayments }}</span>
      </a>
      <a class="stat link pending" routerLink="../listings" *ngIf="s.pendingListings !== null && s.pendingListings !== undefined">
        <span class="stat-label">Awaiting approval</span><span class="stat-num">{{ s.pendingListings }}</span>
      </a>
      <a class="stat link" routerLink="../rooms"><span class="stat-label">Rooms</span><span class="stat-num">{{ s.rooms ?? '—' }}</span></a>
      <a class="stat link" routerLink="../cities"><span class="stat-label">Cities</span><span class="stat-num">{{ s.cities ?? '—' }}</span></a>
      <a class="stat link" routerLink="../owners"><span class="stat-label">Enquiries</span><span class="stat-num">{{ s.bookings ?? '—' }}</span></a>
      <a class="stat link" routerLink="../payments"><span class="stat-label">Payments</span><span class="stat-num">{{ s.payments ?? '—' }}</span></a>
    </div>

    <div class="card">
      <h2>Quick actions</h2>
      <div class="quick">
        <a class="btn btn-primary" routerLink="../listings">Review new listings</a>
        <a class="btn btn-primary" routerLink="../rooms" [queryParams]="{ add: 1 }">＋ Add a Room</a>
        <a class="btn btn-primary" routerLink="../cities" [queryParams]="{ add: 1 }">＋ Register a City</a>
        <a class="btn btn-outline" routerLink="../payments">View Payments</a>
        <a class="btn btn-outline" routerLink="../users">Manage Users</a>
      </div>
    </div>
  `,
  styles: [`
    .stat.link { text-decoration: none; color: inherit; transition: transform .15s, box-shadow .15s; }
    .stat.link:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,.08); }
    .quick { display: flex; gap: .6rem; flex-wrap: wrap; }
    .stat.pending { border-top-color: #b45309; background: #fffbeb; }
  `],
})
export class SaOverview implements OnInit {
  sa = inject(SuperAdminService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  stats = signal<SaStats | null>(null);

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.stats().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.sa.logout();
          this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
          return;
        }
        this.error.set(err?.error?.message || 'Could not load stats.');
      },
    });
  }
}
