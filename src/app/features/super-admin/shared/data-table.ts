// features/super-admin/shared/data-table.ts
// Generic table: works with whatever columns your DB rows have.
import { CommonModule } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';

type ColType = 'text' | 'money' | 'date' | 'bool' | 'status' | 'json';

interface Col {
  key: string;
  label: string;
  type: ColType;
}

@Component({
  selector: 'sa-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="empty" *ngIf="!rowsSig().length">{{ emptyText }}</p>

    <ng-container *ngIf="rowsSig().length">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th *ngFor="let c of cols()" [class.num]="c.type === 'money'">{{ c.label }}</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of paged()">
              <td *ngFor="let c of cols()" [class.num]="c.type === 'money'" [ngSwitch]="c.type">
                <ng-container *ngIf="r[c.key] === null || r[c.key] === undefined || r[c.key] === ''; else val">
                  <span class="dim">—</span>
                </ng-container>
                <ng-template #val>
                  <span *ngSwitchCase="'money'" class="money">₹{{ +r[c.key] | number:'1.0-2' }}</span>
                  <span *ngSwitchCase="'date'">{{ r[c.key] | date:'d MMM y, h:mm a' }}</span>
                  <span *ngSwitchCase="'bool'" [class]="truthy(r[c.key]) ? 'yes' : 'no'">{{ truthy(r[c.key]) ? 'Yes' : 'No' }}</span>
                  <span *ngSwitchCase="'status'" class="pill" [ngClass]="statusClass(r[c.key])">{{ pretty(r[c.key]) }}</span>
                  <span *ngSwitchCase="'json'" class="mono" [title]="json(r[c.key])">{{ json(r[c.key]) | slice:0:60 }}</span>
                  <span *ngSwitchDefault [title]="'' + r[c.key]">{{ ('' + r[c.key]) | slice:0:70 }}{{ ('' + r[c.key]).length > 70 ? '…' : '' }}</span>
                </ng-template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager" *ngIf="totalPages() > 1">
        <button (click)="go(page() - 1)" [disabled]="page() === 1">‹ Prev</button>
        <span>Page {{ page() }} of {{ totalPages() }} · {{ rowsSig().length }} rows</span>
        <button (click)="go(page() + 1)" [disabled]="page() === totalPages()">Next ›</button>
      </div>
    </ng-container>
  `,
  styles: [`
    :host { display: block; font-family: 'DM Sans', sans-serif; }
    .table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: .75rem .9rem; background: #f7f9fc; white-space: nowrap;
      font-size: .7rem; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #666;
      border-bottom: 1px solid #e2e8f0;
    }
    td { padding: .7rem .9rem; font-size: .85rem; color: #2d3748; border-bottom: 1px solid #f1f1f1; white-space: nowrap; }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #fcfcfd; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .money { font-weight: 700; color: #0f3460; }
    .dim { color: #c0c4cc; }
    .yes { color: #047857; font-weight: 600; }
    .no { color: #9ca3af; }
    .mono { font-family: ui-monospace, Menlo, monospace; font-size: .78rem; }
    .pill { display: inline-block; padding: .2rem .6rem; border-radius: 999px; font-size: .72rem; font-weight: 700; background: #f3f4f6; color: #374151; }
    .pill.ok { background: #ecfdf5; color: #047857; }
    .pill.bad { background: #fef2f2; color: #b91c1c; }
    .pill.wait { background: #fffbeb; color: #b45309; }
    .empty { text-align: center; color: #6b7280; padding: 2.5rem 0; margin: 0; }
    .pager { display: flex; justify-content: space-between; align-items: center; margin-top: .9rem; font-size: .82rem; color: #666; gap: 1rem; }
    .pager button { padding: .45rem .9rem; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; cursor: pointer; font: inherit; font-weight: 600; color: #0f3460; }
    .pager button:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class DataTable {
  rowsSig = signal<any[]>([]);
  page = signal(1);
  private preferred = signal<string[]>([]);
  private hiddenKeys = signal<string[]>([]);

  @Input() set rows(v: any[] | null) {
    this.rowsSig.set(v || []);
    this.page.set(1);
  }
  /** Columns to show first, in this order */
  @Input() set columns(v: string[]) {
    this.preferred.set(v || []);
  }
  /** Columns never to show */
  @Input() set hidden(v: string[]) {
    this.hiddenKeys.set(v || []);
  }
  @Input() emptyText = 'Nothing here yet.';
  @Input() pageSize = 15;

  cols = computed<Col[]>(() => {
    const rows = this.rowsSig();
    const seen = new Set<string>();
    for (const r of rows.slice(0, 30)) Object.keys(r || {}).forEach((k) => seen.add(k));
    const hide = new Set(this.hiddenKeys());
    const pref = this.preferred().filter((k) => seen.has(k));
    const rest = [...seen].filter((k) => !pref.includes(k));
    return [...pref, ...rest]
      .filter((k) => !hide.has(k))
      .map((key) => ({ key, label: this.label(key), type: this.typeOf(key, rows) }));
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.rowsSig().length / this.pageSize)));
  paged = computed(() => {
    const start = (Math.min(this.page(), this.totalPages()) - 1) * this.pageSize;
    return this.rowsSig().slice(start, start + this.pageSize);
  });

  go(p: number): void {
    this.page.set(Math.min(Math.max(1, p), this.totalPages()));
  }

  private label(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private typeOf(key: string, rows: any[]): ColType {
    const k = key.toLowerCase();
    const sample = rows.find((r) => r?.[key] !== null && r?.[key] !== undefined && r?.[key] !== '')?.[key];
    if (sample !== undefined && typeof sample === 'object') return 'json';
    if (/status$/.test(k)) return 'status';
    if (/^(is|has)_/.test(k)) return 'bool';
    if (/(_at|_date|^date)$/.test(k) || /^(check_in|check_out)$/.test(k)) return 'date';
    if (/(amount|price|rent|fee|deposit|total|commission|paid|refund)/.test(k) && !/(_id|count|rooms|beds)$/.test(k)) {
      if (sample === undefined || !isNaN(Number(sample))) return 'money';
    }
    return 'text';
  }

  truthy(v: any): boolean {
    return v === true || v === 1 || v === '1' || v === 'true';
  }

  pretty(v: any): string {
    return String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  json(v: any): string {
    try {
      return typeof v === 'string' ? v : JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  statusClass(v: any): string {
    const s = String(v).toLowerCase();
    if (/(success|paid|captured|complete|confirm|active|approved|settled)/.test(s)) return 'ok';
    if (/(fail|cancel|reject|refund|inactive|declin|error)/.test(s)) return 'bad';
    if (/(pending|created|process|initiat|await|hold)/.test(s)) return 'wait';
    return '';
  }
}
