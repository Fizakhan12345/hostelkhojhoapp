// shared/property-extras/property-extras.ts
// Shows food, facilities and house rules that the owner entered.
// Use on the property detail page:  <app-property-extras [propertyId]="p.id"></app-property-extras>
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OwnerService } from '../../core/services/owner.service';

const FACILITY_LABELS: Record<string, string> = {
  wifi: 'WiFi', ac: 'Air conditioning', power_backup: 'Power backup', hot_water: 'Hot water',
  ro_water: 'RO drinking water', laundry: 'Laundry', housekeeping: 'Daily housekeeping',
  attached_bathroom: 'Attached bathroom', study_table: 'Study table', wardrobe: 'Wardrobe',
  fridge: 'Refrigerator', tv: 'TV', cctv: 'CCTV', security_guard: 'Security guard',
  biometric: 'Biometric entry', lift: 'Lift', parking: 'Parking', gym: 'Gym',
};

@Component({
  selector: 'app-property-extras',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="extras() as x">
      <section class="block" *ngIf="x.food">
        <h2>Food</h2>
        <p *ngIf="!x.food.available">Meals are not provided.<ng-container *ngIf="x.food.self_cooking"> Tenants can use the kitchen.</ng-container></p>
        <ng-container *ngIf="x.food.available">
          <p>
            <strong>{{ meals(x.food.meals) }}</strong> · {{ foodType(x.food.type) }} ·
            {{ x.food.included ? 'included in rent' : ('₹' + (x.food.charge | number) + '/month extra') }}
          </p>
          <p class="muted" *ngIf="x.food.notes">{{ x.food.notes }}</p>
          <p class="muted" *ngIf="x.food.self_cooking">Tenants can also use the kitchen.</p>
        </ng-container>
      </section>

      <section class="block" *ngIf="facilityList(x.facilities).length">
        <h2>Facilities</h2>
        <ul class="pills">
          <li *ngFor="let f of facilityList(x.facilities)">{{ f }}</li>
        </ul>
      </section>

      <section class="block" *ngIf="x.rules">
        <h2>House rules</h2>
        <dl class="rules">
          <div *ngIf="x.rules.gate_closing_time"><dt>Gate closes</dt><dd>{{ time(x.rules.gate_closing_time) }}</dd></div>
          <div *ngIf="x.rules.visitors"><dt>Visitors</dt><dd>{{ visitors(x.rules.visitors) }}</dd></div>
          <div *ngIf="x.rules.notice_period_days"><dt>Notice period</dt><dd>{{ x.rules.notice_period_days }} days</dd></div>
          <div *ngIf="x.rules.min_stay_months"><dt>Minimum stay</dt><dd>{{ x.rules.min_stay_months }} months</dd></div>
          <div><dt>Smoking</dt><dd>{{ x.rules.smoking ? 'Allowed' : 'Not allowed' }}</dd></div>
          <div><dt>Alcohol</dt><dd>{{ x.rules.alcohol ? 'Allowed' : 'Not allowed' }}</dd></div>
          <div><dt>Pets</dt><dd>{{ x.rules.pets ? 'Allowed' : 'Not allowed' }}</dd></div>
        </dl>
        <p class="muted pre" *ngIf="x.rules.house_rules">{{ x.rules.house_rules }}</p>
      </section>

      <section class="block" *ngIf="x.nearby">
        <h2>Nearby</h2>
        <p class="pre">{{ x.nearby }}</p>
      </section>
    </ng-container>
  `,
  styles: [`
    :host { display: block; }
    .block { margin-top: 2rem; }
    .block h2 { margin: 0 0 0.75rem; }
    .block p { margin: 0 0 0.4rem; line-height: 1.55; }
    .muted { color: #6B7280; }
    .pre { white-space: pre-line; }
    .pills { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .pills li { padding: 0.4rem 0.8rem; border-radius: 999px; background: #EEF0FF; color: #1B1F5E; font-weight: 600; font-size: 0.88rem; }
    .rules { margin: 0 0 0.75rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
    .rules div { padding: 0.75rem 0.9rem; border: 1px solid #E5E7EB; border-radius: 10px; }
    .rules dt { font-size: 0.82rem; color: #6B7280; }
    .rules dd { margin: 0.15rem 0 0; font-weight: 700; }
  `],
})
export class PropertyExtras implements OnChanges {
  @Input({ required: true }) propertyId!: number | string;

  private owner = inject(OwnerService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  extras = signal<any | null>(null);

  ngOnChanges(): void {
    if (!this.isBrowser || !this.propertyId) return;
    this.owner.extras(this.propertyId).subscribe({
      next: (x) => this.extras.set(x),
      error: () => this.extras.set(null),
    });
  }

  meals(m: string[] | Record<string, boolean>): string {
    const list = Array.isArray(m) ? m : Object.keys(m || {}).filter((k) => (m as any)[k]);
    const nice = list.map((x) => (x === 'snacks' ? 'evening snacks' : x));
    const s = nice.join(', ');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Meals';
  }

  foodType(t: string): string {
    return t === 'non-veg' ? 'Non-veg' : t === 'both' ? 'Veg & non-veg' : 'Veg only';
  }

  facilityList(f: Record<string, any> | null): string[] {
    if (!f) return [];
    return Object.keys(FACILITY_LABELS)
      .filter((k) => f[k] === true)
      .map((k) => (k === 'wifi' && f['wifi_speed'] ? `WiFi (${f['wifi_speed']})` : FACILITY_LABELS[k]));
  }

  visitors(v: string): string {
    return v === 'allowed' ? 'Allowed' : v === 'day-only' ? 'Daytime, common area only' : 'Not allowed';
  }

  time(t: string): string {
    const [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return t;
    const suffix = h >= 12 ? 'pm' : 'am';
    return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${suffix}`;
  }
}
