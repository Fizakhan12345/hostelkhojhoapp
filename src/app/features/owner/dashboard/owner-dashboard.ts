// features/owner/dashboard/owner-dashboard.ts  →  /owner/dashboard
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../../../core/services/admin-auth.service';
import { OwnerMe, OwnerProperty, OwnerService } from '../../../core/services/owner.service';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styleUrls: ['../shared/owner-theme.css'],
  template: `
    <p class="notice ok" *ngIf="welcome">
      Your owner account is ready. Add your first property below — it’s free.
    </p>
    <p class="notice ok" *ngIf="published">Your property is live. Tenants can find it now.</p>
    <p class="notice error" *ngIf="error()">{{ error() }} <button class="linkish" (click)="load()">Try again</button></p>

    <!-- ── Usage: the building ── -->
    <section class="usage" *ngIf="me() as m">
      <div class="usage-copy">
        <h1>{{ m.usage.listings === 0 ? 'Your building is dark' : 'Your properties' }}</h1>
        <p class="lead" *ngIf="m.usage.listings === 0">
          Each property you add switches on a light. Your {{ m.plan.name }} plan has room for {{ m.usage.limit }}.
        </p>
        <p class="lead" *ngIf="m.usage.listings > 0">
          {{ m.usage.listings }} of {{ isUnlimited(m) ? 'unlimited' : m.usage.limit }} listings used on the {{ m.plan.name }} plan<ng-container *ngIf="m.plan.ends_at">, renews by {{ m.plan.ends_at | date:'d MMM y' }}</ng-container>.
        </p>

        <div class="usage-actions">
          <a class="btn btn-main" routerLink="../add-property" *ngIf="m.usage.remaining > 0">Add a property</a>
          <a class="btn btn-main" routerLink="../plans" *ngIf="m.usage.remaining === 0">Upgrade to add more</a>
          <a class="btn btn-ghost" routerLink="../plans" *ngIf="m.usage.remaining > 0 && m.plan.code === 'free'">See paid plans</a>
        </div>
      </div>

      <div class="tower" *ngIf="!isUnlimited(m)" [attr.aria-label]="m.usage.listings + ' of ' + m.usage.limit + ' listing slots used'" role="img">
        <div class="tower-roof"></div>
        <div class="tower-face" [style.grid-template-columns]="'repeat(' + cols(m) + ', 1fr)'">
          <span *ngFor="let w of slots(); let i = index" class="w" [class.on]="i < m.usage.listings"></span>
        </div>
      </div>
    </section>

    <ng-container *ngIf="loading()">
      <div class="skeleton" style="height: 180px"></div>
      <div class="skeleton"></div>
      <div class="skeleton"></div>
    </ng-container>

    <!-- ── Listings ── -->
    <section *ngIf="!loading() && properties().length" class="list">
      <h2>Listings</h2>
      <article class="row surface" *ngFor="let p of properties()">
        <div class="thumb">
          <img *ngIf="p.cover_image; else noPic" [src]="p.cover_image" [alt]="p.name" loading="lazy" />
          <ng-template #noPic><span>No photo</span></ng-template>
        </div>

        <div class="row-main">
          <h3>{{ p.name }}</h3>
          <p class="where">{{ where(p) }}</p>
          <div class="facts">
            <span><strong>{{ p.room_count }}</strong> room types</span>
            <span><strong>{{ p.beds_available }}</strong> beds free</span>
            <span><strong>{{ p.enquiry_count }}</strong> enquiries</span>
            <span *ngIf="p.monthly_rent">from <strong>₹{{ p.monthly_rent | number:'1.0-0' }}</strong>/month</span>
          </div>
        </div>

        <div class="row-side">
          <span class="tag ok" *ngIf="p['is_verified']">Verified</span>
          <span class="tag warn" *ngIf="!p['is_verified']">Awaiting verification</span>
          <a class="btn btn-ghost" [routerLink]="['/properties', p.id]">View listing</a>
        </div>
      </article>
    </section>
  `,
  styles: [`
    .linkish { border: none; background: none; font: inherit; font-weight: 700; color: inherit; text-decoration: underline; cursor: pointer; }

    .usage {
      display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: end;
      background: linear-gradient(180deg, var(--night), var(--dusk));
      border-radius: 18px; padding: 2rem 2rem 0; margin-bottom: 2rem; overflow: hidden;
    }
    .usage h1 { color: #fff; }
    .usage .lead { color: var(--mist); }
    .usage-copy { padding-bottom: 2rem; }
    .usage-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.4rem; }

    .tower { width: 220px; }
    .tower-roof { height: 10px; margin: 0 -8px; background: #0C0E22; border-radius: 3px 3px 0 0; }
    .tower-face { display: grid; gap: 10px; padding: 16px; background: #1A1D45; }
    .w { aspect-ratio: 3 / 4; border-radius: 2px; background: #0E1030; box-shadow: inset 0 0 0 1px rgba(255,255,255,.04); }
    .w.on {
      background: linear-gradient(180deg, #FFE1A6, var(--amber) 60%, #F29A2E);
      box-shadow: 0 0 14px 1px rgba(255, 181, 71, 0.55);
    }

    .list { display: grid; gap: 0.9rem; }
    .row { display: grid; grid-template-columns: 120px 1fr auto; gap: 1.25rem; align-items: center; padding: 1rem; }
    .thumb { width: 120px; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #ECEDF5; display: grid; place-items: center; color: var(--muted); font-size: 0.8rem; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .where { margin: 0.2rem 0 0.6rem; color: var(--muted); font-size: 0.92rem; }
    .facts { display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; font-size: 0.9rem; color: var(--muted); }
    .facts strong { color: var(--ink); }
    .row-side { display: grid; gap: 0.6rem; justify-items: end; }

    @media (max-width: 760px) {
      .usage { grid-template-columns: 1fr; padding: 1.5rem 1.5rem 0; }
      .usage-copy { padding-bottom: 0; }
      .tower { width: 180px; justify-self: center; }
      .row { grid-template-columns: 90px 1fr; }
      .thumb { width: 90px; }
      .row-side { grid-column: 1 / -1; grid-auto-flow: column; justify-content: space-between; align-items: center; }
    }
  `],
})
export class OwnerDashboard implements OnInit {
  private owner = inject(OwnerService);
  private auth = inject(AdminAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  error = signal<string | null>(null);
  me = signal<OwnerMe | null>(null);
  properties = signal<OwnerProperty[]>([]);

  welcome = this.route.snapshot.queryParamMap.get('welcome') === '1';
  published = this.route.snapshot.queryParamMap.get('published') === '1';

  slots = computed(() => Array.from({ length: Math.min(this.me()?.usage.limit || 5, 30) }));

  ngOnInit(): void {
    if (this.auth.isBrowser) this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ me: this.owner.me(), properties: this.owner.properties() }).subscribe({
      next: ({ me, properties }) => {
        this.me.set(me);
        this.properties.set(properties);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.auth.logout();
          this.router.navigate([ADMIN_LOGIN_ROUTE], { queryParams: { tab: 'login' } });
          return;
        }
        this.error.set(err?.error?.message || 'Could not load your dashboard.');
      },
    });
  }

  isUnlimited(m: OwnerMe): boolean {
    return m.usage.limit >= 1000;
  }

  cols(m: OwnerMe): number {
    return m.usage.limit <= 5 ? m.usage.limit : 5;
  }

  where(p: OwnerProperty): string {
    return [p['area'], p['city']].filter((v) => v !== null && v !== undefined && v !== '').join(', ') || 'Location not set';
  }
}
