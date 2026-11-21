// features/super-admin/shared/dynamic-form.ts
// Builds a form from your table's real columns (sent by GET /api/super-admin/schema/:resource).
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaField, SaLookupItem } from '../../../core/services/super-admin.service';

@Component({
  selector: 'sa-dynamic-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="submit()" class="dform">
      <div class="field" *ngFor="let f of fields" [class.wide]="f.kind === 'textarea'" [class.check]="f.kind === 'boolean'">

        <!-- Checkbox -->
        <label *ngIf="f.kind === 'boolean'" class="check-label">
          <input type="checkbox" [(ngModel)]="model[f.name]" [name]="f.name" />
          {{ f.label }}
        </label>

        <!-- Everything else -->
        <ng-container *ngIf="f.kind !== 'boolean'">
          <label [for]="'f_' + f.name">{{ f.label }} <span class="req" *ngIf="f.required">*</span></label>

          <ng-container [ngSwitch]="controlFor(f)">
            <select *ngSwitchCase="'ref'" [id]="'f_' + f.name" [(ngModel)]="model[f.name]" [name]="f.name">
              <option [ngValue]="''">Select {{ f.label }}</option>
              <option *ngFor="let o of lookups[f.ref!] || []" [ngValue]="o.id">{{ o.label }}</option>
            </select>

            <select *ngSwitchCase="'select'" [id]="'f_' + f.name" [(ngModel)]="model[f.name]" [name]="f.name">
              <option [ngValue]="''">Select {{ f.label }}</option>
              <option *ngFor="let o of f.options || []" [ngValue]="o">{{ pretty(o) }}</option>
            </select>

            <textarea *ngSwitchCase="'textarea'" [id]="'f_' + f.name" rows="3"
                      [(ngModel)]="model[f.name]" [name]="f.name"></textarea>

            <input *ngSwitchCase="'number'" type="number" step="any" [id]="'f_' + f.name"
                   [(ngModel)]="model[f.name]" [name]="f.name" />

            <input *ngSwitchCase="'date'" type="date" [id]="'f_' + f.name"
                   [(ngModel)]="model[f.name]" [name]="f.name" />

            <input *ngSwitchCase="'datetime'" type="datetime-local" [id]="'f_' + f.name"
                   [(ngModel)]="model[f.name]" [name]="f.name" />

            <input *ngSwitchDefault type="text" [id]="'f_' + f.name"
                   [(ngModel)]="model[f.name]" [name]="f.name"
                   [placeholder]="f.name === 'slug' ? 'Leave empty to auto-generate' : ''" />
          </ng-container>
        </ng-container>
      </div>

      <p class="error" *ngIf="localError || error">⚠️ {{ localError || error }}</p>

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-save" [disabled]="saving">{{ saving ? 'Saving…' : submitLabel }}</button>
      </div>
    </form>
  `,
  styles: [`
    :host { display: block; font-family: 'DM Sans', sans-serif; }
    .dform { display: grid; grid-template-columns: 1fr 1fr; gap: .9rem 1rem; }
    .field { display: flex; flex-direction: column; gap: .35rem; }
    .field.wide, .field.check, .error, .actions { grid-column: 1 / -1; }
    label { font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #4b5563; }
    .req { color: #dc2626; }
    input, select, textarea {
      width: 100%; padding: .65rem .8rem; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font: inherit; font-size: .9rem; background: #fafafa; outline: none; box-sizing: border-box;
    }
    input:focus, select:focus, textarea:focus { border-color: #0f3460; background: #fff; }
    .check-label { display: flex; align-items: center; gap: .5rem; text-transform: none; letter-spacing: 0; font-size: .9rem; font-weight: 600; cursor: pointer; }
    .check-label input { width: 18px; height: 18px; accent-color: #0f3460; }
    .error { margin: 0; padding: .7rem .9rem; border-radius: 10px; background: #fef2f2; color: #991b1b; font-size: .85rem; }
    .actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: .4rem; }
    .btn-cancel, .btn-save { padding: .7rem 1.2rem; border-radius: 10px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: .82rem; font-weight: 700; }
    .btn-cancel { background: #fff; border: 1.5px solid #e2e8f0; color: #374151; }
    .btn-save { background: linear-gradient(135deg, #1a1a2e, #0f3460); color: #f6c90e; border: none; }
    .btn-save:disabled { opacity: .6; cursor: not-allowed; }
    @media (max-width: 520px) { .dform { grid-template-columns: 1fr; } }
  `],
})
export class DynamicForm {
  @Input() fields: SaField[] = [];
  @Input() lookups: Record<string, SaLookupItem[]> = {};
  @Input() saving = false;
  @Input() error: string | null = null;
  @Input() submitLabel = 'Save';

  @Output() submitted = new EventEmitter<Record<string, any>>();
  @Output() cancelled = new EventEmitter<void>();

  model: Record<string, any> = {};
  localError: string | null = null;

  controlFor(f: SaField): string {
    if (f.kind === 'boolean') return 'boolean';
    if (f.ref) return 'ref';
    return f.kind;
  }

  /** Fill defaults from the DB column defaults */
  reset(): void {
    const m: Record<string, any> = {};
    for (const f of this.fields) {
      if (f.kind === 'boolean') m[f.name] = f.default === '1' || f.default === 1;
      else if (f.default !== null && f.default !== undefined && !/current_timestamp/i.test(String(f.default))) m[f.name] = f.default;
      else m[f.name] = '';
    }
    this.model = m;
    this.localError = null;
  }

  submit(): void {
    const missing = this.fields.filter(
      (f) => f.required && (this.model[f.name] === '' || this.model[f.name] === null || this.model[f.name] === undefined)
    );
    if (missing.length) {
      this.localError = `Please fill: ${missing.map((f) => f.label).join(', ')}`;
      return;
    }
    this.localError = null;
    this.submitted.emit({ ...this.model });
  }

  pretty(v: string): string {
    return v.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
