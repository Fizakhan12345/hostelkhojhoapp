// features/super-admin/owners/sa-owners.ts  →  /super-admin/owners
// How many enquiries each property owner receives.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SaOwner, SaOwnerEnquiry, SuperAdminService } from '../../../core/services/super-admin.service';

type Period = 'all' | '30d' | '7d';
type SortKey = 'enquiries' | 'recent' | 'listings' | 'name';

@Component({
  selector: 'app-sa-owners',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Owners &amp; enquiries</h1>
        <p>How many tenant enquiries each property owner is getting.</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>

    <div class="stat-grid" *ngIf="!loading() && !error()">
      <div class="stat"><span class="stat-label">Owners</span><span class="stat-num">{{ owners().length }}</span></div>
      <div class="stat"><span class="stat-label">Enquiries, all time</span><span class="stat-num">{{ totals().all }}</span></div>
      <div class="stat" *ngIf="hasDates()"><span class="stat-label">Last 30 days</span><span class="stat-num">{{ totals().d30 }}</span></div>
      <div class="stat" *ngIf="hasDates()"><span class="stat-label">Last 7 days</span><span class="stat-num">{{ totals().d7 }}</span></div>
      <div class="stat warn"><span class="stat-label">Owners with no enquiries</span><span class="stat-num">{{ totals().none }}</span></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">
          <span>🔍</span>
          <input type="text" placeholder="Search owner name, email or phone" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <div class="chips" *ngIf="hasDates()" role="group" aria-label="Period">
          <button class="chip" [class.active]="period() === 'all'" (click)="period.set('all')">All time</button>
          <button class="chip" [class.active]="period() === '30d'" (click)="period.set('30d')">30 days</button>
          <button class="chip" [class.active]="period() === '7d'" (click)="period.set('7d')">7 days</button>
        </div>
        <label class="sort">
          Sort
          <select [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
            <option value="enquiries">Most enquiries</option>
            <option value="recent">Latest enquiry</option>
            <option value="listings">Most listings</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3,4]"></div></ng-container>
      <p class="empty" *ngIf="!loading() && !error() && !rows().length">No owners match.</p>

      <div class="table-wrap" *ngIf="!loading() && rows().length">
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Plan</th>
              <th class="num">Listings</th>
              <th class="num">Enquiries ({{ periodLabel() }})</th>
              <th>Status</th>
              <th>Last enquiry</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of rows()" (click)="open(o)" (keyup.enter)="open(o)" tabindex="0" [class.off]="!o.is_active">
              <td>
                <p class="name">{{ o.full_name }}</p>
                <p class="sub">{{ o.email }}<ng-container *ngIf="o.phone"> · {{ o.phone }}</ng-container></p>
              </td>
              <td><span class="plan" [class.paid]="o.plan !== 'free'">{{ planName(o.plan) }}</span></td>
              <td class="num">{{ o.listings }}</td>
              <td class="num">
                <div class="bar-cell">
                  <span class="bar"><span class="fill" [style.width.%]="barWidth(o)"></span></span>
                  <strong>{{ countFor(o) }}</strong>
                </div>
              </td>
              <td>
                <span class="mini" *ngFor="let s of statusList(o)" [ngClass]="statusClass(s.key)">{{ s.n }} {{ pretty(s.key) }}</span>
                <span class="dim" *ngIf="!statusList(o).length">—</span>
              </td>
              <td>{{ o.last_enquiry_at ? (o.last_enquiry_at | date:'d MMM, h:mm a') : '—' }}</td>
              <td class="right"><span class="view">View</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Owner's enquiries -->
    <ng-container *ngIf="selected() as o">
      <div class="panel-overlay" (click)="close()"></div>
      <aside class="panel" role="dialog" [attr.aria-label]="'Enquiries for ' + o.full_name">
        <div class="panel-head">
          <div>
            <h2>{{ o.full_name }}</h2>
            <p class="panel-sub">{{ o.enquiries }} enquir{{ o.enquiries === 1 ? 'y' : 'ies' }} across {{ o.listings }} listing{{ o.listings === 1 ? '' : 's' }}</p>
          </div>
          <button class="panel-close" (click)="close()" aria-label="Close">×</button>
        </div>
        <div class="panel-body">
          <div class="contact">
            <a *ngIf="o.phone" class="btn btn-outline" [href]="'tel:' + o.phone">Call {{ o.phone }}</a>
            <a *ngIf="o.email" class="btn btn-outline" [href]="'mailto:' + o.email">Email owner</a>
          </div>

          <ng-container *ngIf="detailLoading()"><div class="skeleton" *ngFor="let s of [1,2,3]"></div></ng-container>
          <p class="alert error" *ngIf="detailError()">{{ detailError() }}</p>

          <div *ngIf="!detailLoading() && byProperty().length" class="by-prop">
            <h3>By property</h3>
            <div class="prop-row" *ngFor="let p of byProperty()">
              <span>{{ p.name }}</span><strong>{{ p.n }}</strong>
            </div>
          </div>

          <p class="empty" *ngIf="!detailLoading() && !detailError() && !enquiries().length">
            No enquiries yet for this owner.
          </p>

          <div class="enq" *ngFor="let e of enquiries()">
            <div class="enq-top">
              <strong>{{ e.tenant_name || 'Tenant' }}</strong>
              <span class="mini" [ngClass]="statusClass(e.status)">{{ pretty(e.status) }}</span>
            </div>
            <p class="enq-prop">{{ e.property_name }}</p>
            <p class="enq-meta">
              <span *ngIf="e.tenant_phone"><a [href]="'tel:' + e.tenant_phone">{{ e.tenant_phone }}</a></span>
              <span *ngIf="e.tenant_email">{{ e.tenant_email }}</span>
              <span *ngIf="e.move_in">Move-in {{ e.move_in | date:'d MMM y' }}</span>
              <span *ngIf="e.months">{{ e.months }} mo</span>
            </p>
            <p class="enq-when">{{ e.created_at ? ('Received ' + (e.created_at | date:'d MMM y, h:mm a')) : '' }} · Ref {{ e.ref }}</p>
          </div>
        </div>
      </aside>
    </ng-container>
  `,
  styles: [`
    .stat.warn { border-top-color: #b45309; }
    .sort { display: flex; align-items: center; gap: .5rem; font-size: .82rem; font-weight: 600; color: var(--muted); margin-left: auto; }
    .sort select { padding: .5rem .7rem; border: 1.5px solid var(--border); border-radius: 8px; font: inherit; color: var(--ink); background: #fff; }

    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; min-width: 860px; }
    th { text-align: left; padding: .75rem .9rem; background: #f7f9fc; font-size: .7rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #666; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: .75rem .9rem; font-size: .86rem; border-bottom: 1px solid #f1f1f1; vertical-align: middle; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: #fcfbf6; }
    tbody tr:focus-visible { outline: 2px solid var(--navy-3); outline-offset: -2px; }
    tr:last-child td { border-bottom: none; }
    tr.off td { color: #9aa3ae; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .right { text-align: right; }
    .name { margin: 0; font-weight: 700; color: var(--navy-1); }
    .sub { margin: .1rem 0 0; font-size: .78rem; color: var(--muted); }
    .plan { display: inline-block; padding: .2rem .55rem; border-radius: 6px; font-size: .74rem; font-weight: 700; background: #eef0f4; color: var(--muted); }
    .plan.paid { background: #fff9e6; color: #92400e; }

    .bar-cell { display: flex; align-items: center; justify-content: flex-end; gap: .6rem; }
    .bar { width: 90px; height: 8px; border-radius: 4px; background: #eef0f4; overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--gold); border-radius: 4px; }
    .bar-cell strong { min-width: 2ch; font-size: .95rem; color: var(--navy-1); }

    .mini { display: inline-block; margin: 0 .3rem .2rem 0; padding: .15rem .5rem; border-radius: 999px; font-size: .72rem; font-weight: 700; background: #eef0f4; color: #374151; white-space: nowrap; }
    .mini.ok { background: var(--green-lt); color: var(--green); }
    .mini.bad { background: var(--red-lt); color: var(--red); }
    .mini.wait { background: var(--amber-lt); color: var(--amber); }
    .dim { color: #c0c4cc; }
    .view { font-weight: 700; color: var(--navy-3); font-size: .82rem; }
    .empty { text-align: center; color: var(--muted); padding: 2rem 0; margin: 0; }

    .panel-sub { margin: .2rem 0 0; color: var(--muted); font-size: .85rem; }
    .contact { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
    .by-prop { border: 1px solid var(--border); border-radius: 12px; padding: .8rem 1rem; margin-bottom: 1.1rem; }
    .by-prop h3 { margin: 0 0 .5rem; font-family: 'Sora', sans-serif; font-size: .9rem; color: var(--navy-1); }
    .prop-row { display: flex; justify-content: space-between; padding: .35rem 0; font-size: .88rem; border-bottom: 1px dashed #eee; }
    .prop-row:last-child { border-bottom: none; }
    .enq { padding: .85rem 0; border-bottom: 1px solid #f1f1f1; }
    .enq-top { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
    .enq-prop { margin: .2rem 0; color: var(--navy-3); font-weight: 600; font-size: .86rem; }
    .enq-meta { margin: 0; display: flex; flex-wrap: wrap; gap: .2rem .9rem; font-size: .82rem; color: var(--ink); }
    .enq-meta a { color: var(--navy-3); font-weight: 600; }
    .enq-when { margin: .3rem 0 0; font-size: .76rem; color: var(--muted); }
  `],
})
export class SaOwners implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  owners = signal<SaOwner[]>([]);
  hasDates = signal(true);

  search = signal('');
  period = signal<Period>('all');
  sortBy = signal<SortKey>('enquiries');

  selected = signal<SaOwner | null>(null);
  enquiries = signal<SaOwnerEnquiry[]>([]);
  detailLoading = signal(false);
  detailError = signal<string | null>(null);

  totals = computed(() => {
    const list = this.owners();
    return {
      all: list.reduce((n, o) => n + o.enquiries, 0),
      d30: list.reduce((n, o) => n + (o.enquiries_30d || 0), 0),
      d7: list.reduce((n, o) => n + (o.enquiries_7d || 0), 0),
      none: list.filter((o) => o.enquiries === 0).length,
    };
  });

  rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.owners().filter(
      (o) => !q || [o.full_name, o.email, o.phone, String(o.id)].some((v) => (v || '').toLowerCase().includes(q))
    );
    const sort = this.sortBy();
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.full_name.localeCompare(b.full_name);
      if (sort === 'listings') return b.listings - a.listings;
      if (sort === 'recent') return new Date(b.last_enquiry_at || 0).getTime() - new Date(a.last_enquiry_at || 0).getTime();
      return this.countFor(b) - this.countFor(a) || b.enquiries - a.enquiries;
    });
  });

  private maxCount = computed(() => Math.max(1, ...this.owners().map((o) => this.countFor(o))));

  byProperty = computed(() => {
    const m = new Map<string, number>();
    for (const e of this.enquiries()) m.set(e.property_name, (m.get(e.property_name) || 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  });

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.owners().subscribe({
      next: (r) => {
        this.owners.set(r.owners || []);
        this.hasDates.set(r.hasDates);
        if (!r.hasDates) this.period.set('all');
        this.loading.set(false);
      },
      error: (err) => this.fail(err),
    });
  }

  open(o: SaOwner): void {
    this.selected.set(o);
    this.enquiries.set([]);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.sa.ownerEnquiries(o.id).subscribe({
      next: (list) => {
        this.enquiries.set(list);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || 'Could not load enquiries.');
      },
    });
  }

  close(): void {
    this.selected.set(null);
  }

  countFor(o: SaOwner): number {
    const p = this.period();
    if (p === '30d') return o.enquiries_30d || 0;
    if (p === '7d') return o.enquiries_7d || 0;
    return o.enquiries;
  }

  barWidth(o: SaOwner): number {
    return Math.round((this.countFor(o) / this.maxCount()) * 100);
  }

  periodLabel(): string {
    return this.period() === '30d' ? '30 days' : this.period() === '7d' ? '7 days' : 'all time';
  }

  statusList(o: SaOwner): { key: string; n: number }[] {
    return Object.entries(o.by_status || {}).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  }

  statusClass(s: string): string {
    const v = s.toLowerCase();
    if (/(confirm|approved|paid|complete|active)/.test(v)) return 'ok';
    if (/(cancel|reject|fail)/.test(v)) return 'bad';
    if (/(pending|new|enquir|request)/.test(v)) return 'wait';
    return '';
  }

  pretty(s: string): string {
    return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  planName(code: string): string {
    return code === 'pro' ? 'Pro' : code === 'business' ? 'Business' : 'Starter';
  }

  private fail(err: any): void {
    this.loading.set(false);
    if (err?.status === 401 || err?.status === 403) {
      this.sa.logout();
      this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
      return;
    }
    this.error.set(err?.error?.message || 'Could not load owners.');
  }
}
