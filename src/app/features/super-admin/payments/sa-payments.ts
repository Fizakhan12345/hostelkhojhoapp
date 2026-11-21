// features/super-admin/payments/sa-payments.ts  →  route: /super-admin/payments
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SuperAdminService } from '../../../core/services/super-admin.service';
import { DataTable } from '../shared/data-table';

const AMOUNT_KEYS = ['amount', 'total_amount', 'paid_amount', 'amount_paid', 'payment_amount', 'price'];
const STATUS_KEYS = ['status', 'payment_status', 'transaction_status'];

@Component({
  selector: 'app-sa-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Payments</h1>
        <p>All user payments. Card numbers are masked and secrets are never shown.</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <div class="stat-grid" *ngIf="!loading() && !error()">
      <div class="stat"><span class="stat-label">Transactions</span><span class="stat-num">{{ rows().length }}</span></div>
      <div class="stat"><span class="stat-label">Collected</span><span class="stat-num">₹{{ summary().collected | number:'1.0-0' }}</span></div>
      <div class="stat"><span class="stat-label">Successful</span><span class="stat-num">{{ summary().ok }}</span></div>
      <div class="stat"><span class="stat-label">Pending</span><span class="stat-num">{{ summary().pending }}</span></div>
      <div class="stat"><span class="stat-label">Failed / Refunded</span><span class="stat-num">{{ summary().failed }}</span></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">
          <span>🔍</span>
          <input type="text" placeholder="Search user, email, property, transaction ID…" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <div class="chips" *ngIf="statuses().length > 1">
          <button class="chip" [class.active]="status() === 'all'" (click)="status.set('all')">all</button>
          <button *ngFor="let s of statuses()" class="chip" [class.active]="status() === s" (click)="status.set(s)">{{ s.replace('_', ' ') }}</button>
        </div>
      </div>

      <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>
      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3,4,5]"></div></ng-container>

      <sa-data-table *ngIf="!loading() && !error()"
        [rows]="filtered()"
        [columns]="preferred"
        [emptyText]="rows().length ? 'No payments match.' : 'No payments recorded yet.'">
      </sa-data-table>
    </div>
  `,
})
export class SaPayments implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);

  preferred = [
    'id', 'user_name', 'user_email', 'user_phone', 'property_name', 'booking_reference',
    'amount', 'total_amount', 'currency', 'status', 'payment_status', 'payment_method', 'method',
    'transaction_id', 'razorpay_payment_id', 'razorpay_order_id', 'created_at',
  ];

  loading = signal(true);
  error = signal<string | null>(null);
  rows = signal<any[]>([]);
  search = signal('');
  status = signal('all');

  private statusOf(r: any): string {
    const k = STATUS_KEYS.find((key) => r?.[key] !== undefined && r?.[key] !== null);
    return k ? String(r[k]).toLowerCase() : '';
  }
  private amountOf(r: any): number {
    const k = AMOUNT_KEYS.find((key) => r?.[key] !== undefined && r?.[key] !== null && !isNaN(Number(r[key])));
    return k ? Number(r[k]) : 0;
  }

  statuses = computed(() => [...new Set(this.rows().map((r) => this.statusOf(r)).filter(Boolean))].sort());

  summary = computed(() => {
    let collected = 0, ok = 0, pending = 0, failed = 0;
    for (const r of this.rows()) {
      const s = this.statusOf(r);
      if (/(success|paid|captured|complete|settled)/.test(s)) { ok++; collected += this.amountOf(r); }
      else if (/(fail|cancel|refund|declin|error)/.test(s)) failed++;
      else pending++;
    }
    return { collected, ok, pending, failed };
  });

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const st = this.status();
    return this.rows().filter((r) => {
      if (st !== 'all' && this.statusOf(r) !== st) return false;
      if (!q) return true;
      return Object.values(r || {}).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
    });
  });

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.list('payments').subscribe({
      next: (rows) => { this.rows.set(rows); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.sa.logout();
          this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
          return;
        }
        this.error.set(err?.error?.message || 'Could not load payments.');
      },
    });
  }
}
