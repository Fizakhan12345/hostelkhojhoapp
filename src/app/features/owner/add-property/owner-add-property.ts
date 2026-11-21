// features/owner/add-property/owner-add-property.ts  →  /owner/add-property
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ADMIN_LOGIN_ROUTE, AdminAuthService } from '../../../core/services/admin-auth.service';
import {
  MAX_PROPERTY_PHOTOS,
  OwnerMe,
  OwnerMeta,
  OwnerService,
  PHOTO_CATEGORIES,
  PhotoCategory,
} from '../../../core/services/owner.service';

interface RoomForm {
  room_type: string;
  capacity: number | null;
  total_beds: number | null;
  available: number | null;
  price_per_bed: number | null;
  is_ac: boolean;
}

interface Photo {
  file: File;
  url: string;
  category: PhotoCategory;
  caption: string;
}

@Component({
  selector: 'app-owner-add-property',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './owner-add-property.html',
  styleUrls: ['../shared/owner-theme.css', './owner-add-property.css'],
})
export class OwnerAddProperty implements OnInit, OnDestroy {
  private owner = inject(OwnerService);
  private auth = inject(AdminAuthService);
  private router = inject(Router);

  readonly steps = ['Basics', 'Location', 'Rooms & rent', 'Food & facilities', 'House rules', 'Photos'];
  step = signal(0);

  loading = signal(true);
  publishing = signal(false);
  error = signal<string | null>(null);
  stepError = signal<string | null>(null);

  me = signal<OwnerMe | null>(null);
  meta = signal<OwnerMeta | null>(null);

  // ── Form model ──────────────────────────────────────────
  basics = { name: '', property_type: '', gender_allowed: '', description: '' };

  location = { address: '', area: '', city_id: null as number | null, city: '', state: '', pincode: '', landmark: '', nearby: '' };

  rooms: RoomForm[] = [this.newRoom('Double sharing', 2)];
  security_deposit: number | null = null;

  food = {
    available: true,
    meals: { breakfast: true, lunch: false, dinner: true, snacks: false },
    type: 'veg' as 'veg' | 'non-veg' | 'both',
    included: true,
    charge: null as number | null,
    self_cooking: false,
    notes: '',
  };

  readonly facilityList: { key: string; label: string }[] = [
    { key: 'wifi', label: 'WiFi' },
    { key: 'ac', label: 'Air conditioning' },
    { key: 'power_backup', label: 'Power backup' },
    { key: 'hot_water', label: 'Hot water / geyser' },
    { key: 'ro_water', label: 'RO drinking water' },
    { key: 'laundry', label: 'Laundry / washing machine' },
    { key: 'housekeeping', label: 'Daily housekeeping' },
    { key: 'attached_bathroom', label: 'Attached bathroom' },
    { key: 'study_table', label: 'Study table & chair' },
    { key: 'wardrobe', label: 'Wardrobe' },
    { key: 'fridge', label: 'Refrigerator' },
    { key: 'tv', label: 'TV in common area' },
    { key: 'cctv', label: 'CCTV' },
    { key: 'security_guard', label: 'Security guard' },
    { key: 'biometric', label: 'Biometric / card entry' },
    { key: 'lift', label: 'Lift' },
    { key: 'parking', label: 'Two-wheeler parking' },
    { key: 'gym', label: 'Gym' },
  ];
  facilities: Record<string, boolean> = { wifi: true, power_backup: true, hot_water: true, ro_water: true };
  wifi_speed = '';
  amenityIds = new Set<number>();

  rules = {
    gate_closing_time: '22:30',
    visitors: 'day-only' as 'not-allowed' | 'day-only' | 'allowed',
    smoking: false,
    alcohol: false,
    pets: false,
    notice_period_days: 30 as number | null,
    min_stay_months: 3 as number | null,
    house_rules: '',
  };

  photos: Photo[] = [];
  readonly maxPhotos = MAX_PROPERTY_PHOTOS;
  readonly photoCategories = PHOTO_CATEGORIES;
  /** category given to the next photos the owner adds */
  uploadCategory: PhotoCategory = 'room';

  countFor(cat: PhotoCategory): number {
    return this.photos.filter((p) => p.category === cat).length;
  }

  /** e.g. "8 photos: 4 room, 2 amenities, 2 washroom" */
  get photoSummary(): string {
    if (!this.photos.length) return '';
    const parts = this.photoCategories
      .map((c) => ({ n: this.countFor(c.value), label: c.label.toLowerCase() }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} ${x.label}`);
    return `${this.photos.length} photo${this.photos.length === 1 ? '' : 's'}: ${parts.join(', ')}`;
  }

  // ── Lifecycle ───────────────────────────────────────────
  ngOnInit(): void {
    if (!this.auth.isBrowser) return;
    forkJoin({ me: this.owner.me(), meta: this.owner.meta() }).subscribe({
      next: ({ me, meta }) => {
        this.me.set(me);
        this.meta.set(meta);
        this.basics.property_type = this.basics.property_type || meta.options.property_type[0] || '';
        this.basics.gender_allowed = this.basics.gender_allowed || meta.options.gender_allowed[0] || '';
        if (meta.options.room_type?.length) this.rooms[0].room_type = meta.options.room_type[0];
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 401 || err?.status === 403) {
          this.auth.logout();
          this.router.navigate([ADMIN_LOGIN_ROUTE], { queryParams: { tab: 'login' } });
          return;
        }
        this.error.set(err?.error?.message || 'Could not load the form.');
      },
    });
  }

  ngOnDestroy(): void {
    this.photos.forEach((p) => URL.revokeObjectURL(p.url));
  }

  // ── Helpers for the template ───────────────────────────
  pretty(v: string): string {
    return String(v).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  newRoom(type = 'Single', capacity = 1): RoomForm {
    return { room_type: type, capacity, total_beds: capacity, available: capacity, price_per_bed: null, is_ac: false };
  }

  addRoom(): void {
    const types = this.meta()?.options.room_type;
    this.rooms.push(this.newRoom(types?.[0] || 'Triple sharing', 3));
  }

  removeRoom(i: number): void {
    if (this.rooms.length > 1) this.rooms.splice(i, 1);
  }

  toggleAmenity(id: number): void {
    this.amenityIds.has(id) ? this.amenityIds.delete(id) : this.amenityIds.add(id);
  }

  onCityChange(id: number | null): void {
    this.location.city_id = id;
    const c = this.meta()?.cities.find((x) => x.id === id);
    if (c) {
      this.location.city = c.name;
      if (c.state && !this.location.state) this.location.state = c.state;
    }
  }

  get lowestPrice(): number | null {
    const prices = this.rooms.map((r) => Number(r.price_per_bed)).filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  get mealsChosen(): string[] {
    return Object.entries(this.food.meals).filter(([, v]) => v).map(([k]) => k);
  }

  get facilitiesChosen(): string[] {
    return this.facilityList.filter((f) => this.facilities[f.key]).map((f) => f.label);
  }

  // ── Photos ─────────────────────────────────────────────
  onPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.stepError.set(null);

    for (const file of files) {
      if (this.photos.length >= this.maxPhotos) {
        this.stepError.set(`You can add up to ${this.maxPhotos} photos.`);
        break;
      }
      if (!/image\/(jpeg|jpg|png|webp)/.test(file.type)) {
        this.stepError.set(`${file.name} isn’t a JPG, PNG or WEBP photo.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.stepError.set(`${file.name} is bigger than 5 MB.`);
        continue;
      }
      this.photos.push({ file, url: URL.createObjectURL(file), category: this.uploadCategory, caption: '' });
    }
  }

  removePhoto(i: number): void {
    URL.revokeObjectURL(this.photos[i].url);
    this.photos.splice(i, 1);
  }

  makeCover(i: number): void {
    const [p] = this.photos.splice(i, 1);
    this.photos.unshift(p);
  }

  // ── Steps ──────────────────────────────────────────────
  private validate(step: number): string | null {
    switch (step) {
      case 0:
        if (this.basics.name.trim().length < 3) return 'Give your property a name (at least 3 letters).';
        if (!this.basics.property_type) return 'Choose the property type.';
        if (!this.basics.gender_allowed) return 'Choose who can stay.';
        return null;
      case 1:
        if (!this.location.address.trim()) return 'Enter the full address.';
        if (!this.location.city_id && !this.location.city.trim()) return 'Choose the city.';
        if (this.location.pincode && !/^\d{6}$/.test(this.location.pincode)) return 'Pincode should be 6 digits.';
        return null;
      case 2:
        for (const [i, r] of this.rooms.entries()) {
          if (!r.room_type) return `Room ${i + 1}: choose the room type.`;
          if (!r.price_per_bed || r.price_per_bed < 500) return `Room ${i + 1}: enter the monthly rent per bed (₹500 or more).`;
          if (!r.capacity || r.capacity < 1) return `Room ${i + 1}: how many people share it?`;
          if ((r.available ?? 0) > (r.total_beds ?? 0)) return `Room ${i + 1}: free beds can’t be more than total beds.`;
        }
        return null;
      case 3:
        if (this.food.available && !this.mealsChosen.length) return 'Pick at least one meal, or switch food off.';
        if (this.food.available && !this.food.included && !this.food.charge) return 'Enter the monthly food charge.';
        return null;
      default:
        return null;
    }
  }

  next(): void {
    const msg = this.validate(this.step());
    this.stepError.set(msg);
    if (!msg) {
      this.step.set(Math.min(this.step() + 1, this.steps.length - 1));
      this.scrollTop();
    }
  }

  back(): void {
    this.stepError.set(null);
    this.step.set(Math.max(this.step() - 1, 0));
    this.scrollTop();
  }

  goTo(i: number): void {
    // only allow jumping back, or forward through steps that validate
    for (let s = 0; s < i; s++) {
      const msg = this.validate(s);
      if (msg) {
        this.step.set(s);
        this.stepError.set(msg);
        return;
      }
    }
    this.stepError.set(null);
    this.step.set(i);
  }

  private scrollTop(): void {
    if (this.auth.isBrowser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Publish ────────────────────────────────────────────
  publish(): void {
    for (let s = 0; s < this.steps.length; s++) {
      const msg = this.validate(s);
      if (msg) {
        this.step.set(s);
        this.stepError.set(msg);
        return;
      }
    }

    const facilities: Record<string, any> = { ...this.facilities };
    if (facilities['wifi'] && this.wifi_speed) facilities['wifi_speed'] = this.wifi_speed;

    const data = {
      ...this.basics,
      ...this.location,
      security_deposit: this.security_deposit,
      monthly_rent: this.lowestPrice,
      rooms: this.rooms,
      amenity_ids: [...this.amenityIds],
      food: this.food.available
        ? { ...this.food, meals: this.mealsChosen }
        : { available: false, self_cooking: this.food.self_cooking },
      facilities,
      rules: this.rules,
      nearby: this.location.nearby,
    };

    this.publishing.set(true);
    this.error.set(null);
    this.owner
      .createProperty(data, this.photos.map((p) => ({ file: p.file, category: p.category, caption: p.caption.trim() })))
      .subscribe({
      next: () => {
        this.publishing.set(false);
        this.router.navigate(['/owner/dashboard'], { queryParams: { published: 1 } });
      },
      error: (err) => {
        this.publishing.set(false);
        if (err?.status === 402) {
          this.error.set(err?.error?.message || 'You’ve used all listings on your plan.');
          return;
        }
        this.error.set(err?.error?.message || 'Could not publish. Check your details and try again.');
      },
    });
  }
}
