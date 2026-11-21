// features/super-admin/users/sa-users.ts  →  route: /super-admin/users
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SUPER_ADMIN_LOGIN_ROUTE, SaUser, SuperAdminService } from '../../../core/services/super-admin.service';

type Filter = 'all' | 'active' | 'inactive' | 'verified' | 'unverified';

@Component({
  selector: 'app-sa-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../shared/sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>Users</h1>
        <p>{{ users().length }} registered tenants</p>
      </div>
      <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">
          <span>🔍</span>
          <input type="text" placeholder="Search name, email, phone or ID" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)" />
        </div>
        <div class="chips">
          <button *ngFor="let f of filters" class="chip" [class.active]="filter() === f" (click)="filter.set(f); page.set(1)">{{ f }}</button>
        </div>
      </div>

      <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>
      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3,4,5]"></div></ng-container>
      <p class="empty" *ngIf="!loading() && !error() && !filtered().length">No users match.</p>

      <div class="table-wrap" *ngIf="!loading() && filtered().length">
        <table>
          <thead>
            <tr><th>User</th><th>Phone</th><th>Gender</th><th>Joined</th><th class="num">Bookings</th><th class="num">Saved</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of paged()" [class.off]="!on(u.is_active)">
              <td>
                <div class="user">
                  <div class="avatar">
                    <img *ngIf="u.profile_pic; else ini" [src]="u.profile_pic" alt="" />
                    <ng-template #ini>{{ (u.full_name || '?').charAt(0).toUpperCase() }}</ng-template>
                  </div>
                  <div>
                    <p class="name">{{ u.full_name }} <span class="tick" *ngIf="on(u.is_verified)">✓</span></p>
                    <p class="email">{{ u.email }}</p>
                  </div>
                </div>
              </td>
              <td>{{ u.phone || '—' }}</td>
              <td>{{ u.gender ? (u.gender | titlecase) : '—' }}</td>
              <td>{{ u.created_at ? (u.created_at | date:'d MMM y') : '—' }}</td>
              <td class="num">{{ u.bookings_count }}</td>
              <td class="num">{{ u.favorites_count }}</td>
              <td><span class="pill" [class.ok]="on(u.is_active)">{{ on(u.is_active) ? 'Active' : 'Inactive' }}</span></td>
              <td class="right">
                <button class="act" [class.danger]="on(u.is_active)" [disabled]="busy().has(u.id)" (click)="toggle(u)">
                  {{ busy().has(u.id) ? '…' : (on(u.is_active) ? 'Deactivate' : 'Activate') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager" *ngIf="!loading() && pages() > 1">
        <button (click)="page.set(page() - 1)" [disabled]="page() === 1">‹ Prev</button>
        <span>Page {{ page() }} of {{ pages() }}</span>
        <button (click)="page.set(page() + 1)" [disabled]="page() === pages()">Next ›</button>
      </div>
    </div>

    <div class="toast" *ngIf="toast()">{{ toast() }}</div>
  `,
  styles: [`
    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    th { text-align: left; padding: .75rem .9rem; background: #f7f9fc; font-size: .7rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #666; border-bottom: 1px solid var(--border); }
    td { padding: .7rem .9rem; font-size: .86rem; border-bottom: 1px solid #f1f1f1; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr.off td { color: #9aa3ae; }
    .num { text-align: right; } .right { text-align: right; }
    .user { display: flex; align-items: center; gap: .7rem; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; position: relative; overflow: hidden;
              background: linear-gradient(135deg, var(--navy-3), var(--gold)); color: #fff; font-weight: 700;
              display: flex; align-items: center; justify-content: center; }
    .avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .name { margin: 0; font-weight: 700; color: var(--navy-1); }
    .email { margin: .1rem 0 0; font-size: .78rem; color: var(--muted); }
    .tick { display: inline-flex; width: 15px; height: 15px; border-radius: 50%; background: #22c55e; color: #fff; font-size: .6rem; align-items: center; justify-content: center; }
    .pill { display: inline-block; padding: .2rem .6rem; border-radius: 999px; font-size: .72rem; font-weight: 700; background: var(--red-lt); color: var(--red); }
    .pill.ok { background: var(--green-lt); color: var(--green); }
    .act { padding: .4rem .8rem; border-radius: 8px; cursor: pointer; font: inherit; font-size: .76rem; font-weight: 700; min-width: 92px;
           background: #fff; border: 1.5px solid #bbf7d0; color: var(--green); }
    .act.danger { border-color: #fecaca; color: var(--red); }
    .act:disabled { opacity: .5; }
    .empty { text-align: center; color: var(--muted); padding: 2rem 0; }
    .pager { display: flex; justify-content: space-between; align-items: center; margin-top: .9rem; font-size: .82rem; color: #666; }
    .pager button { padding: .45rem .9rem; border-radius: 8px; border: 1.5px solid var(--border); background: #fff; cursor: pointer; font: inherit; font-weight: 600; color: var(--navy-3); }
    .pager button:disabled { opacity: .5; }
  `],
})
export class SaUsers implements OnInit {
  private sa = inject(SuperAdminService);
  private router = inject(Router);

  filters: Filter[] = ['all', 'active', 'inactive', 'verified', 'unverified'];
  loading = signal(true);
  error = signal<string | null>(null);
  toast = signal<string | null>(null);
  users = signal<SaUser[]>([]);
  busy = signal<Set<number>>(new Set());
  search = signal('');
  filter = signal<Filter>('all');
  page = signal(1);
  private readonly size = 12;

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.users().filter((u) => {
      const a = this.on(u.is_active), v = this.on(u.is_verified);
      if ((f === 'active' && !a) || (f === 'inactive' && a) || (f === 'verified' && !v) || (f === 'unverified' && v)) return false;
      return !q || [u.full_name, u.email, u.phone, String(u.id)].some((x) => (x || '').toLowerCase().includes(q));
    });
  });
  pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.size)));
  paged = computed(() => {
    const p = Math.min(this.page(), this.pages());
    return this.filtered().slice((p - 1) * this.size, p * this.size);
  });

  ngOnInit(): void {
    if (this.sa.isBrowser) this.load();
  }

  on(v: any): boolean {
    return !!Number(v);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sa.users().subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: (err) => this.fail(err, 'Could not load users.'),
    });
  }

  toggle(u: SaUser): void {
    const next = !this.on(u.is_active);
    if (!confirm(`${next ? 'Activate' : 'Deactivate'} ${u.full_name}?`)) return;
    this.setBusy(u.id, true);
    this.sa.setUserActive(u.id, next).subscribe({
      next: () => {
        this.users.set(this.users().map((x) => (x.id === u.id ? { ...x, is_active: next ? 1 : 0 } : x)));
        this.setBusy(u.id, false);
        this.flash(`${u.full_name} ${next ? 'activated' : 'deactivated'}.`);
      },
      error: (err) => { this.setBusy(u.id, false); this.flash(err?.error?.message || 'Update failed.'); },
    });
  }

  private setBusy(id: number, on: boolean): void {
    const s = new Set(this.busy());
    on ? s.add(id) : s.delete(id);
    this.busy.set(s);
  }

  private fail(err: any, msg: string): void {
    this.loading.set(false);
    if (err?.status === 401 || err?.status === 403) {
      this.sa.logout();
      this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
      return;
    }
    this.error.set(err?.error?.message || msg);
  }

  private t?: ReturnType<typeof setTimeout>;
  private flash(m: string): void {
    this.toast.set(m);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.toast.set(null), 3000);
  }
}
