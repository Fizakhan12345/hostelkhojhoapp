// features/super-admin/shared/sa-resource-page.ts
// One page component used for both /super-admin/rooms and /super-admin/cities.
// The route's `data` decides which table it shows (see app.routes.ts).
import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  SUPER_ADMIN_LOGIN_ROUTE,
  SaResource,
  SaSchema,
  SuperAdminService,
} from '../../../core/services/super-admin.service';
import { DataTable } from './data-table';
import { DynamicForm } from './dynamic-form';

export interface SaResourcePageData {
  resource: SaResource;
  title: string;
  subtitle: string;
  addLabel: string;
  columns?: string[];
  hidden?: string[];
}

@Component({
  selector: 'app-sa-resource-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTable, DynamicForm],
  styleUrls: ['./sa-common.css'],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ cfg.title }}</h1>
        <p>{{ cfg.subtitle }} · {{ rows().length }} total</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-outline" (click)="load()" [disabled]="loading()">↻ Refresh</button>
        <button class="btn btn-primary" (click)="openPanel()" [disabled]="!schema()?.creatable">＋ {{ cfg.addLabel }}</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">
          <span>🔍</span>
          <input type="text" [placeholder]="'Search ' + cfg.title.toLowerCase()" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </div>
        <span class="count" *ngIf="search()">{{ filtered().length }} match{{ filtered().length === 1 ? '' : 'es' }}</span>
      </div>

      <p class="alert error" *ngIf="error()">⚠️ {{ error() }} <button class="link-btn" (click)="load()">Try again</button></p>
      <ng-container *ngIf="loading()"><div class="skeleton" *ngFor="let s of [1,2,3,4,5]"></div></ng-container>

      <sa-data-table *ngIf="!loading() && !error()"
        [rows]="filtered()"
        [columns]="cfg.columns || []"
        [hidden]="cfg.hidden || []"
        [emptyText]="search() ? 'No matches.' : 'Nothing here yet — add the first one.'">
      </sa-data-table>
    </div>

    <!-- Add panel -->
    <ng-container *ngIf="panelOpen()">
      <div class="panel-overlay" (click)="closePanel()"></div>
      <div class="panel" role="dialog" [attr.aria-label]="cfg.addLabel">
        <div class="panel-head">
          <h2>{{ cfg.addLabel }}</h2>
          <button class="panel-close" (click)="closePanel()" aria-label="Close">×</button>
        </div>
        <div class="panel-body">
          <sa-dynamic-form #form
            [fields]="schema()?.fields || []"
            [lookups]="schema()?.lookups || {}"
            [saving]="saving()"
            [error]="saveError()"
            [submitLabel]="cfg.addLabel"
            (submitted)="save($event)"
            (cancelled)="closePanel()">
          </sa-dynamic-form>
        </div>
      </div>
    </ng-container>

    <div class="toast" *ngIf="toast()">{{ toast() }}</div>
  `,
  styles: [`
    .head-actions { display: flex; gap: .6rem; }
    .count { font-size: .82rem; color: var(--muted); }
  `],
})
export class SaResourcePage implements OnInit {
  private sa = inject(SuperAdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('form') form?: DynamicForm;

  cfg: SaResourcePageData = this.route.snapshot.data as SaResourcePageData;

  loading = signal(true);
  error = signal<string | null>(null);
  rows = signal<any[]>([]);
  schema = signal<SaSchema | null>(null);
  search = signal('');

  panelOpen = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);
  toast = signal<string | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) =>
      Object.values(r || {}).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    if (!this.sa.isBrowser) return;
    this.load(this.route.snapshot.queryParamMap.get('add') === '1');
  }

  load(openAfter = false): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ rows: this.sa.list(this.cfg.resource), schema: this.sa.schema(this.cfg.resource) }).subscribe({
      next: ({ rows, schema }) => {
        this.rows.set(rows);
        this.schema.set(schema);
        this.loading.set(false);
        if (openAfter && schema.creatable) this.openPanel();
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.sa.logout();
          this.router.navigate([SUPER_ADMIN_LOGIN_ROUTE]);
          return;
        }
        this.error.set(err?.error?.message || `Could not load ${this.cfg.title.toLowerCase()}.`);
      },
    });
  }

  openPanel(): void {
    this.saveError.set(null);
    this.panelOpen.set(true);
    // wait one tick so the form exists, then fill DB defaults
    setTimeout(() => this.form?.reset());
  }

  closePanel(): void {
    if (this.saving()) return;
    this.panelOpen.set(false);
  }

  save(body: Record<string, any>): void {
    this.saving.set(true);
    this.saveError.set(null);
    this.sa.create(this.cfg.resource, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.panelOpen.set(false);
        this.flash(`${this.cfg.addLabel.replace(/^(Add|Register) (a |an )?/i, '')} saved.`);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.message || 'Could not save.');
      },
    });
  }

  private t?: ReturnType<typeof setTimeout>;
  private flash(m: string): void {
    this.toast.set(m);
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => this.toast.set(null), 3000);
  }
}
