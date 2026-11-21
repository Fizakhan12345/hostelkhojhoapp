// features/owner/enquiries/owner-enquiries.ts  →  /owner/enquiries
// Free plan: first 5 enquiries show contact details; the rest arrive from the
// server without them (locked) until the owner upgrades.
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../../../core/services/admin-auth.service';
import { EnquirySummary, OwnerService } from '../../../core/services/owner.service';

interface Enquiry {
  id: number;
  ref: string;
  property: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  moveIn: string | null;
  months: number | null;
  status: string;
  createdAt: string | null;
  locked: boolean;
}

function pick(o: any, keys: string[]): any {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== '') return o[k];
  return null;
}

@Component({
  selector: 'app-owner-enquiries',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['../shared/owner-theme.css'],
  template: `
    <h1>Enquiries</h1>
    <p class="lead">People who asked to book one of your properties. Call them back quickly — most tenants decide within a day.</p>

    <!-- Free-plan limit -->
    <section class="limit surface" *ngIf="summary() as s">
      <ng-container *ngIf="s.free_limit !== null">
        <div class="limit-text">
          <h2 *ngIf="s.locked > 0">{{ s.locked }} tenant{{ s.locked === 1 ? ' is' : 's are' }} waiting for your reply</h2>
          <h2 *ngIf="s.locked === 0">{{ s.unlocked }} of {{ s.free_limit }} free enquiries used</h2>
          <p *ngIf="s.locked > 0">
            The Starter plan shows contact details for your first {{ s.free_limit }} enquiries.
            Upgrade to see every tenant’s name, phone and email.
          </p>
          <p *ngIf="s.locked === 0">
            On the Starter plan you can see contact details for {{ s.free_limit }} enquiries.
            After that, new enquiries stay locked until you upgrade.
          </p>
          <div class="meter" role="img" [attr.aria-label]="s.unlocked + ' of ' + s.free_limit + ' free enquiries used'">
            <span [style.width.%]="meterWidth(s)"></span>
          </div>
        </div>
        <a class="btn btn-main" routerLink="../plans">{{ s.locked > 0 ? 'Unlock ' + s.locked + ' enquir' + (s.locked === 1 ? 'y' : 'ies') : 'See plans' }}</a>
      </ng-container>
    </section>

    <p class="notice error" *ngIf="error()">{{ error() }}</p>

    <div class="list">
      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3]"></div></ng-container>

      <div class="surface empty" *ngIf="!loading() && !error() && !items().length">
        <h2>No enquiries yet</h2>
        <p class="lead">When a tenant sends a booking request for one of your listings, it shows up here.</p>
        <a class="btn btn-ghost" routerLink="../dashboard">Back to my properties</a>
      </div>

      <article class="surface enq" *ngFor="let e of items()" [class.locked]="e.locked">
        <div class="enq-main">
          <h3>{{ e.name || 'Tenant' }}</h3>
          <p class="prop">{{ e.property }}</p>
          <p class="meta">
            <span *ngIf="e.moveIn">Moving in {{ e.moveIn | date:'d MMM y' }}</span>
            <span *ngIf="e.months">for {{ e.months }} month{{ e.months === 1 ? '' : 's' }}</span>
            <span *ngIf="e.createdAt">Received {{ e.createdAt | date:'d MMM, h:mm a' }}</span>
          </p>
        </div>

        <div class="enq-side" *ngIf="!e.locked">
          <span class="tag" [ngClass]="tagClass(e.status)">{{ pretty(e.status) }}</span>
          <a class="btn btn-main" *ngIf="e.phone" [href]="'tel:' + e.phone">Call {{ e.phone }}</a>
          <a class="btn btn-ghost" *ngIf="e.email" [href]="'mailto:' + e.email">Email</a>
          <span class="ref">Ref {{ e.ref }}</span>
        </div>

        <div class="enq-side" *ngIf="e.locked">
          <div class="hidden-contact" aria-hidden="true">
            <span>98••• •••••</span>
            <span>••••••@•••••.com</span>
          </div>
          <a class="btn btn-dark" routerLink="../plans">Upgrade to see contact details</a>
        </div>
      </article>
    </div>
  `,
  styles: [`
    .limit { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; margin-top: 1.5rem; flex-wrap: wrap;
             border: 1.5px solid var(--amber); background: #FFFBF2; }
    .limit-text { flex: 1; min-width: 260px; }
    .limit h2 { margin: 0 0 .35rem; font-size: 1.2rem; }
    .limit p { margin: 0; color: var(--muted); line-height: 1.5; max-width: 62ch; }
    .meter { margin-top: .8rem; height: 8px; max-width: 320px; border-radius: 4px; background: #EEE7D6; overflow: hidden; }
    .meter span { display: block; height: 100%; background: var(--saffron); border-radius: 4px; }

    .list { display: grid; gap: 0.9rem; margin-top: 1.5rem; }
    .empty { text-align: left; }
    .empty .btn { margin-top: 1rem; }
    .enq { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center; }
    .prop { margin: 0.2rem 0 0.4rem; color: var(--dusk); font-weight: 600; }
    .meta { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; color: var(--muted); font-size: 0.9rem; }
    .enq-side { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: flex-end; }
    .ref { width: 100%; text-align: right; font-size: 0.8rem; color: var(--muted); }

    .enq.locked { background: #FBFBFE; border-style: dashed; }
    .hidden-contact { display: grid; gap: .15rem; text-align: right; font-weight: 600; color: var(--muted);
                      filter: blur(3px); user-select: none; }

    @media (max-width: 680px) {
      .enq { grid-template-columns: 1fr; }
      .enq-side { justify-content: flex-start; }
      .ref, .hidden-contact { text-align: left; }
    }
  `],
})
export class OwnerEnquiries implements OnInit {
  private owner = inject(OwnerService);
  private auth = inject(AdminAuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  items = signal<Enquiry[]>([]);
  summary = signal<EnquirySummary | null>(null);

  ngOnInit(): void {
    if (!this.auth.isBrowser) return;
    this.owner.enquiries().subscribe({
      next: ({ enquiries, summary }) => {
        this.summary.set(summary);
        this.items.set(
          enquiries.map((b) => ({
            id: b.id,
            ref: pick(b, ['booking_ref', 'booking_code', 'reference']) || `#${b.id}`,
            property: b.property_name || 'Your property',
            name: pick(b, ['full_name', 'name', 'tenant_name', 'guest_name']),
            phone: b.locked ? null : pick(b, ['phone', 'mobile', 'contact', 'guest_phone']),
            email: b.locked ? null : pick(b, ['email', 'guest_email']),
            moveIn: pick(b, ['check_in_date', 'check_in', 'move_in_date', 'start_date']),
            months: Number(pick(b, ['duration_months', 'duration', 'months'])) || null,
            status: String(pick(b, ['status', 'booking_status']) || 'new'),
            createdAt: pick(b, ['created_at', 'booked_at']),
            locked: !!b.locked,
          }))
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.auth.logout();
          this.router.navigate([ADMIN_LOGIN_ROUTE], { queryParams: { tab: 'login' } });
          return;
        }
        this.error.set(err?.error?.message || 'Could not load enquiries.');
      },
    });
  }

  meterWidth(s: EnquirySummary): number {
    if (!s.free_limit) return 100;
    return Math.min(100, Math.round((s.unlocked / s.free_limit) * 100));
  }

  pretty(s: string): string {
    return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  tagClass(s: string): string {
    const v = s.toLowerCase();
    if (/(confirm|approved|paid|complete)/.test(v)) return 'ok';
    if (/(cancel|reject|fail)/.test(v)) return 'off';
    return 'warn';
  }
}
