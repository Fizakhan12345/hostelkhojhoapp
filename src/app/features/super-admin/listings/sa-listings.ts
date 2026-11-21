// features/super-admin/listings/sa-listings.ts  →  /super-admin/listings
// Review properties added by owners and approve them.
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SaListing, SuperAdminService } from '../../../core/services/super-admin.service';

type Filter = 'pending' | 'verified' | 'hidden' | 'all';

@Component({
  selector: 'app-sa-listings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Listings</h1>
        <p>Check each property before it gets the Verified badge. {{ counts().pending }} waiting for approval.</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <p class="alert error" *ngIf="!canVerify() && !loading()">
      Your properties table has no is_verified column, so listings can’t be approved yet.
    </p>

    <div class="card">
      <div class="toolbar">
        <div class="search">
          <span>🔍</span>
          <input type="text" placeholder="Search name, city, owner, phone" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <div class="chips">
          <button class="chip" [class.active]="filter() === 'pending'" (click)="filter.set('pending')">Awaiting approval ({{ counts().pending }})</button>
          <button class="chip" [class.active]="filter() === 'verified'" (click)="filter.set('verified')">Verified ({{ counts().verified }})</button>
          <button class="chip" *ngIf="canHide()" [class.active]="filter() === 'hidden'" (click)="filter.set('hidden')">Hidden ({{ counts().hidden }})</button>
          <button class="chip" [class.active]="filter() === 'all'" (click)="filter.set('all')">All ({{ counts().all }})</button>
        </div>
      </div>

      <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>
      <ng-container *ngIf="loading()"><div class="skeleton" style="height: 110px" *ngFor="let s of [1,2,3]"></div></ng-container>

      <p class="empty" *ngIf="!loading() && !error() && !filtered().length">
        {{ filter() === 'pending' ? 'Nothing waiting — every listing has been reviewed.' : 'No listings here.' }}
      </p>

      <div class="rows" *ngIf="!loading() && filtered().length">
        <article class="row" *ngFor="let p of filtered()" [class.hidden-row]="!p.is_active">
          <div class="thumb">
            <img *ngIf="p.cover_image; else noPic" [src]="p.cover_image" [alt]="p.name" loading="lazy" />
            <ng-template #noPic><span>No photo</span></ng-template>
          </div>

          <div class="main">
            <div class="title">
              <h3>{{ p.name }}</h3>
              <span class="pill ok" *ngIf="p.is_verified">Verified</span>
              <span class="pill wait" *ngIf="!p.is_verified">Awaiting approval</span>
              <span class="pill off" *ngIf="!p.is_active">Hidden</span>
            </div>
            <p class="where">
              {{ place(p) }}
              <ng-container *ngIf="p.property_type"> · {{ pretty(p.property_type) }}</ng-container>
              <ng-container *ngIf="p.gender_allowed"> for {{ pretty(p.gender_allowed) }}</ng-container>
            </p>
            <p class="facts">
              <span>{{ p.room_count }} room types</span>
              <span [class.warn]="p.photo_count === 0">{{ p.photo_count }} photos</span>
              <span *ngIf="p.monthly_rent">from ₹{{ +p.monthly_rent | number:'1.0-0' }}/month</span>
              <span *ngIf="p.created_at">added {{ p.created_at | date:'d MMM y' }}</span>
            </p>
            <p class="owner" *ngIf="p.owner_name">
              Owner: <strong>{{ p.owner_name }}</strong>
              <a *ngIf="p.owner_phone" [href]="'tel:' + p.owner_phone">{{ p.owner_phone }}</a>
              <a *ngIf="p.owner_email" [href]="'mailto:' + p.owner_email">{{ p.owner_email }}</a>
            </p>
          </div>

          <div class="actions">
            <a class="btn btn-outline" [href]="'/properties/' + p.id" target="_blank" rel="noopener">View listing</a>
            <button class="btn btn-approve" *ngIf="!p.is_verified && canVerify()" [disabled]="busy().has(p.id)" (click)="verify(p, true)">
              {{ busy().has(p.id) ? 'Saving…' : 'Approve' }}
            </button>
            <button class="btn btn-outline danger" *ngIf="p.is_verified && canVerify()" [disabled]="busy().has(p.id)" (click)="verify(p, false)">
              Remove approval
            </button>
            <button class="btn btn-outline" *ngIf="canHide()" [disabled]="busy().has(p.id)" (click)="visible(p, !p.is_active)">
              {{ p.is_active ? 'Hide from tenants' : 'Show again' }}
            </button>
          </div>
        </article>
      </div>
    </div>

    <div class="toast" *ngIf="toast()">{{ toast() }}</div>
  `,
  styles: [`
    .rows { display: grid; gap: .75rem; }
    .row {
      display: grid; grid-template-columns: 140px 1fr auto; gap: 1.1rem; align-items: center;
      padding: .9rem; border: 1px solid var(--border); border-radius: 12px; background: #fff;
    }
    .row.hidden-row { opacity: .6; }
    .thumb { width: 140px; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #f1f2f6;
             display: grid; place-items: center; color: var(--muted); font-size: .8rem; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .title { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .title h3 { margin: 0; font-family: 'Sora', sans-serif; font-size: 1.02rem; color: var(--navy-1); }
    .pill { display: inline-block; padding: .18rem .55rem; border-radius: 999px; font-size: .72rem; font-weight: 700; }
    .pill.ok { background: var(--green-lt); color: var(--green); }
    .pill.wait { background: var(--amber-lt); color: var(--amber); }
    .pill.off { background: #eef0f4; color: var(--muted); }
    .where { margin: .3rem 0 .35rem; color: var(--muted); font-size: .88rem; }
    .facts { margin: 0; display: flex; flex-wrap: wrap; gap: .25rem 1rem; font-size: .84rem; color: var(--ink); }
    .facts .warn { color: var(--red); font-weight: 600; }
    .owner { margin: .4rem 0 0; font-size: .84rem; color: var(--muted); display: flex; gap: .3rem .8rem; flex-wrap: wrap; }
    .owner a { color: var(--navy-3); font-weight: 600; }
    .actions { display: grid; gap: .45rem; justify-items: stretch; min-width: 170px; }
    .btn-approve { background: var(--green); color: #fff; }
    .btn-approve:hover:not(:disabled) { background: #065f46; }
    .danger { color: var(--red); }
    .empty { text-align: center; color: var(--muted); padding: 2rem 0; margin: 0; }
    @media (max-width: 820px) {
      .row { grid-template-columns: 96px 1fr; }
      .thumb { width: 96px; }
      .actions { grid-column: 1 / -1; grid-auto-flow: column; min-width: 0; }
    }
  `],
})
export class SaListings implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal<string | null>(null);
  toast = signal<string | null>(null);
  items = signal<SaListing[]>([]);
  canVerify = signal(true);
  canHide = signal(false);
  busy = signal<Set<number>>(new Set());
  search = signal('');
  filter = signal<Filter>((this.route.snapshot.queryParamMap.get('filter') as Filter) || 'pending');

  counts = computed(() => {
    const all = this.items();
    return {
      all: all.length,
      pending: all.filter((p) => !p.is_verified).length,
      verified: all.filter((p) => p.is_verified).length,
      hidden: all.filter((p) => !p.is_active).length,
    };
  });

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.items().filter((p) => {
      if (f === 'pending' && p.is_verified) return false;
      if (f === 'verified' && !p.is_verified) return false;
      if (f === 'hidden' && p.is_active) return false;
      if (!q) return true;
      return [p.name, p.city, p.area, p.owner_name, p.owner_phone, p.owner_email, String(p.id)]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  });

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.listings().subscribe({
      next: (r) => {
        this.items.set(r.properties || []);
        this.canVerify.set(r.canVerify);
        this.canHide.set(r.canHide);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.sa.logout();
          this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
          return;
        }
        this.error.set(err?.error?.message || 'Could not load listings.');
      },
    });
  }

  verify(p: SaListing, value: boolean): void {
    if (!value && !confirm(`Remove approval from ${p.name}? It will show as awaiting verification again.`)) return;
    this.run(p, this.sa.setVerified(p.id, value), { is_verified: value }, value ? `${p.name} approved.` : `Approval removed from ${p.name}.`);
  }

  visible(p: SaListing, value: boolean): void {
    if (!value && !confirm(`Hide ${p.name} from tenants? The owner will still see it in their dashboard.`)) return;
    this.run(p, this.sa.setVisible(p.id, value), { is_active: value }, value ? `${p.name} is visible again.` : `${p.name} is hidden.`);
  }

  private run(p: SaListing, call: ReturnType<SuperAdminService['setVerified']>, patch: Partial<SaListing>, msg: string): void {
    this.setBusy(p.id, true);
    call.subscribe({
      next: () => {
        this.items.set(this.items().map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
        this.setBusy(p.id, false);
        this.flash(msg);
      },
      error: (err) => {
        this.setBusy(p.id, false);
        this.flash(err?.error?.message || 'Could not save. Try again.');
      },
    });
  }

  place(p: SaListing): string {
    return [p.area, p.city].filter(Boolean).join(', ') || 'Location not set';
  }

  pretty(s: string): string {
    return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private setBusy(id: number, on: boolean): void {
    const s = new Set(this.busy());
    on ? s.add(id) : s.delete(id);
    this.busy.set(s);
  }

  private t?: ReturnType<typeof setTimeout>;
  private flash(m: string): void {
    this.toast.set(m);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.toast.set(null), 3000);
  }
}
