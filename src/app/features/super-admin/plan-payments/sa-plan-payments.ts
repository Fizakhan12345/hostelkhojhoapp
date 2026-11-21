// features/super-admin/plan-payments/sa-plan-payments.ts  →  /super-admin/plan-payments
// Owners' subscription payments. UPI ones wait here until you confirm the money reached your bank.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SaPlanPayment, SuperAdminService } from '../../../core/services/super-admin.service';

type Filter = 'pending' | 'paid' | 'rejected' | 'all';

@Component({
  selector: 'app-sa-plan-payments',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Plan payments</h1>
        <p>Owners paying for Pro or Business. Check each UPI payment in your bank app before confirming.</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <div class="stat-grid" *ngIf="!loading() && !error()">
      <div class="stat pending"><span class="stat-label">Waiting for you</span><span class="stat-num">{{ counts().pending }}</span></div>
      <div class="stat"><span class="stat-label">Confirmed payments</span><span class="stat-num">{{ counts().paid }}</span></div>
      <div class="stat"><span class="stat-label">Received this month</span><span class="stat-num">₹{{ monthTotal() | number:'1.0-0' }}</span></div>
      <div class="stat"><span class="stat-label">Received all time</span><span class="stat-num">₹{{ allTotal() | number:'1.0-0' }}</span></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="chips">
          <button class="chip" [class.active]="filter() === 'pending'" (click)="filter.set('pending')">Waiting ({{ counts().pending }})</button>
          <button class="chip" [class.active]="filter() === 'paid'" (click)="filter.set('paid')">Confirmed ({{ counts().paid }})</button>
          <button class="chip" [class.active]="filter() === 'rejected'" (click)="filter.set('rejected')">Rejected ({{ counts().rejected }})</button>
          <button class="chip" [class.active]="filter() === 'all'" (click)="filter.set('all')">All</button>
        </div>
      </div>

      <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>
      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3]"></div></ng-container>

      <p class="empty" *ngIf="!loading() && !error() && !rows().length">
        {{ filter() === 'pending' ? 'Nothing to check. New UPI payments will appear here.' : 'No payments here yet.' }}
      </p>

      <div class="rows" *ngIf="!loading() && rows().length">
        <article class="row" *ngFor="let p of rows()" [class.is-pending]="p.status === 'pending'">
          <div class="main">
            <div class="title">
              <h3>{{ p.owner_name }}</h3>
              <span class="pill" [ngClass]="p.status">{{ statusLabel(p.status) }}</span>
            </div>
            <p class="what">
              <strong>₹{{ p.amount | number }}</strong> for {{ p.plan_name }}
              · {{ p.method === 'upi' ? 'UPI' : 'Razorpay' }}
              <ng-container *ngIf="p.created_at"> · {{ p.created_at | date:'d MMM y, h:mm a' }}</ng-container>
            </p>
            <p class="ref" *ngIf="p.reference">
              {{ p.method === 'upi' ? 'UTR' : 'Payment ID' }}: <code>{{ p.reference }}</code>
            </p>
            <p class="contact">
              <a *ngIf="p.owner_phone" [href]="'tel:' + p.owner_phone">{{ p.owner_phone }}</a>
              <a *ngIf="p.owner_email" [href]="'mailto:' + p.owner_email">{{ p.owner_email }}</a>
            </p>
            <p class="active" *ngIf="p.status === 'paid' && p.ends_at">Active {{ p.starts_at | date:'d MMM' }} – {{ p.ends_at | date:'d MMM y' }}</p>
          </div>

          <div class="actions" *ngIf="p.status === 'pending'">
            <button class="btn btn-approve" [disabled]="busy().has(p.id)" (click)="review(p, 'approve')">
              {{ busy().has(p.id) ? 'Saving…' : 'Money received — activate' }}
            </button>
            <button class="btn btn-outline danger" [disabled]="busy().has(p.id)" (click)="review(p, 'reject')">Not received</button>
          </div>
        </article>
      </div>
    </div>

    <div class="toast" *ngIf="toast()">{{ toast() }}</div>
  `,
  styles: [`
    .stat.pending { border-top-color: #b45309; background: #fffbeb; }
    .rows { display: grid; gap: .75rem; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center;
           padding: 1rem 1.1rem; border: 1px solid var(--border); border-radius: 12px; background: #fff; }
    .row.is-pending { border: 1.5px solid #f6c90e; background: #fffdf4; }
    .title { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
    .title h3 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1rem; color: var(--navy-1); }
    .pill { padding: .18rem .55rem; border-radius: 999px; font-size: .72rem; font-weight: 700; }
    .pill.pending { background: var(--amber-lt); color: var(--amber); }
    .pill.paid { background: var(--green-lt); color: var(--green); }
    .pill.rejected { background: var(--red-lt); color: var(--red); }
    .what { margin: .35rem 0 .2rem; font-size: .9rem; color: var(--ink); }
    .ref { margin: 0 0 .2rem; font-size: .85rem; color: var(--muted); }
    .ref code { font-size: .92rem; font-weight: 700; color: var(--navy-1); background: #f3f4f8; padding: .1rem .4rem; border-radius: 5px; }
    .contact { margin: 0; display: flex; gap: .3rem 1rem; flex-wrap: wrap; font-size: .84rem; }
    .contact a { color: var(--navy-3); font-weight: 600; }
    .active { margin: .3rem 0 0; font-size: .82rem; color: var(--green); font-weight: 600; }
    .actions { display: grid; gap: .45rem; min-width: 210px; }
    .btn-approve { background: var(--green); color: #fff; }
    .btn-approve:hover:not(:disabled) { background: #065f46; }
    .danger { color: var(--red); }
    .empty { text-align: center; color: var(--muted); padding: 2rem 0; margin: 0; }
    @media (max-width: 720px) {
      .row { grid-template-columns: 1fr; }
      .actions { grid-auto-flow: column; min-width: 0; }
    }
  `],
})
export class SaPlanPayments implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  toast = signal<string | null>(null);
  items = signal<SaPlanPayment[]>([]);
  busy = signal<Set<number>>(new Set());
  filter = signal<Filter>('pending');

  counts = computed(() => {
    const l = this.items();
    return {
      pending: l.filter((p) => p.status === 'pending').length,
      paid: l.filter((p) => p.status === 'paid').length,
      rejected: l.filter((p) => p.status === 'rejected').length,
    };
  });

  allTotal = computed(() => this.items().filter((p) => p.status === 'paid').reduce((n, p) => n + p.amount, 0));

  monthTotal = computed(() => {
    const now = new Date();
    return this.items()
      .filter((p) => p.status === 'paid' && p.created_at)
      .filter((p) => {
        const d = new Date(p.created_at!);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((n, p) => n + p.amount, 0);
  });

  rows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.items() : this.items().filter((p) => p.status === f);
  });

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.planPayments().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.sa.logout();
          this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
          return;
        }
        this.error.set(err?.error?.message || 'Could not load plan payments.');
      },
    });
  }

  review(p: SaPlanPayment, action: 'approve' | 'reject'): void {
    const msg =
      action === 'approve'
        ? `Confirm ₹${p.amount} with UTR ${p.reference} reached your bank account? ${p.owner_name}'s ${p.plan_name} plan will start now.`
        : `Mark this payment as not received? ${p.owner_name} will be told to contact support.`;
    if (!confirm(msg)) return;

    const s = new Set(this.busy());
    s.add(p.id);
    this.busy.set(s);

    this.sa.reviewPlanPayment(p.id, action).subscribe({
      next: (res) => {
        this.items.set(
          this.items().map((x) =>
            x.id === p.id
              ? { ...x, status: action === 'approve' ? 'paid' : 'rejected', starts_at: res.starts_at ?? x.starts_at, ends_at: res.ends_at ?? x.ends_at }
              : x
          )
        );
        this.clearBusy(p.id);
        this.flash(action === 'approve' ? `${p.owner_name}'s ${p.plan_name} plan is active.` : 'Marked as not received.');
      },
      error: (err) => {
        this.clearBusy(p.id);
        this.flash(err?.error?.message || 'Could not save. Try again.');
      },
    });
  }

  statusLabel(s: string): string {
    return s === 'pending' ? 'Waiting for you' : s === 'paid' ? 'Confirmed' : 'Not received';
  }

  private clearBusy(id: number): void {
    const s = new Set(this.busy());
    s.delete(id);
    this.busy.set(s);
  }

  private t?: ReturnType<typeof setTimeout>;
  private flash(m: string): void {
    this.toast.set(m);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.toast.set(null), 3500);
  }
}
