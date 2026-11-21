// features/property-search/find-hostel.ts  →  route: /find-hostel
// Same class name, files and route as before. Data now comes from /api/home/search,
// which includes listings added through the owner portal.
import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environment';

type RentType = 'monthly' | 'daily';
type SortKey = 'newest' | 'price_low' | 'price_high' | 'rating';

interface CityOption { id: number | null; name: string; slug: string; count: number; }

interface Card {
  id: number;
  name: string;
  location: string;
  city: string;
  price: number;
  image: string | null;
  gallery: string[];
  rating: number;
  reviews: number;
  type: string;
  gender: string;
  amenities: string[];
  distance: string | null;
  verified: boolean;
  beds_available: number;
  food: { available: boolean; type: string | null; included: boolean } | null;
}

interface SearchResponse {
  city: CityOption | null;
  priceUnit: 'month' | 'day';
  dailySupported?: boolean;
  properties: Card[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

@Component({
  selector: 'app-find-hostel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './find-hostel.html',
  styleUrls: ['./find-hostel.css'],
})
export class FindHostelComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private reqSub?: Subscription;
  private qpSub?: Subscription;
  private debounce?: ReturnType<typeof setTimeout>;

  // filter options from the database
  cities = signal<CityOption[]>([]);
  types = signal<string[]>([]);
  genders = signal<string[]>([]);
  dailySupported = signal(true);

  // filters
  rentType = signal<RentType>('monthly');
  citySlug = signal('');
  propertyType = signal('');
  gender = signal('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  q = signal('');
  sort = signal<SortKey>('newest');
  page = signal(1);

  // results
  properties = signal<Card[]>([]);
  pagination = signal<SearchResponse['pagination'] | null>(null);
  priceUnit = signal<'month' | 'day'>('month');
  loading = signal(true);
  refreshing = signal(false);
  failed = signal(false);

  readonly skyline = Array.from({ length: 34 }, (_, i) => ({
    h: 40 + ((i * 37) % 70),               // building heights (fixed pattern, same on server & browser)
    lit: [3, 7, 11, 16, 20, 25, 29].includes(i),
    d: [3, 7, 11, 16, 20, 25, 29].indexOf(i),
  }));

  activeCount = computed(
    () => [this.citySlug(), this.propertyType(), this.gender(), this.minPrice(), this.maxPrice(), this.q()].filter((v) => v !== '' && v !== null).length
  );

  cityName = computed(() => this.cities().find((c) => c.slug === this.citySlug())?.name || '');

  pages = computed(() => {
    const p = this.pagination();
    if (!p || p.totalPages <= 1) return [];
    const to = Math.min(p.totalPages, Math.max(5, p.page + 2));
    const from = Math.max(1, to - 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });

  ngOnInit(): void {
    this.http.get<{ cities: CityOption[]; types: string[]; genders: string[]; dailySupported: boolean }>(
      `${environment.apiUrl}/home/search/options`
    ).subscribe({
      next: (o) => {
        this.cities.set(o.cities || []);
        this.types.set(o.types || []);
        this.genders.set(o.genders || []);
        this.dailySupported.set(o.dailySupported !== false);
      },
      error: () => {},
    });

    // read filters from the URL (/find-hostel?city=mumbai&type=pg …) and search
    this.qpSub = this.route.queryParamMap.subscribe((m) => {
      this.rentType.set(m.get('rent') === 'daily' ? 'daily' : 'monthly');
      this.citySlug.set(m.get('city') || '');
      this.propertyType.set(m.get('type') || '');
      this.gender.set(m.get('gender') || '');
      this.minPrice.set(m.get('min') ? Number(m.get('min')) : null);
      this.maxPrice.set(m.get('max') ? Number(m.get('max')) : null);
      this.q.set(m.get('q') || '');
      this.sort.set((m.get('sort') as SortKey) || 'newest');
      this.page.set(Number(m.get('page')) || 1);
      this.runSearch();
    });
  }

  ngOnDestroy(): void {
    this.reqSub?.unsubscribe();
    this.qpSub?.unsubscribe();
    if (this.debounce) clearTimeout(this.debounce);
  }

  // ── Filter changes → update the URL (which triggers the search) ──
  private pushUrl(resetPage = true): void {
    if (resetPage) this.page.set(1);
    const qp: Record<string, string | number | null> = {
      rent: this.rentType() === 'daily' ? 'daily' : null,
      city: this.citySlug() || null,
      type: this.propertyType() || null,
      gender: this.gender() || null,
      min: this.minPrice() || null,
      max: this.maxPrice() || null,
      q: this.q().trim() || null,
      sort: this.sort() !== 'newest' ? this.sort() : null,
      page: this.page() > 1 ? this.page() : null,
    };
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
  }

  switchRentType(type: RentType): void {
    if (this.rentType() === type) return;
    this.rentType.set(type);
    // monthly and daily ranges mean very different numbers — clear them
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.pushUrl();
  }

  setCity(slug: string): void { this.citySlug.set(slug); this.pushUrl(); }
  setType(t: string): void { this.propertyType.set(this.propertyType() === t ? '' : t); this.pushUrl(); }
  setGender(g: string): void { this.gender.set(this.gender() === g ? '' : g); this.pushUrl(); }
  setSort(s: SortKey): void { this.sort.set(s); this.pushUrl(); }

  /** price & text fields: wait until the user stops typing */
  typed(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.pushUrl(), 450);
  }

  applyFilters(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.pushUrl();
  }

  clearFilters(): void {
    this.citySlug.set('');
    this.propertyType.set('');
    this.gender.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.q.set('');
    this.pushUrl();
  }

  goToPage(n: number): void {
    const p = this.pagination();
    if (!p || n < 1 || n > p.totalPages || n === p.page) return;
    this.page.set(n);
    this.pushUrl(false);
    if (this.isBrowser) document.getElementById('find-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Search ──────────────────────────────────────────────
  private runSearch(): void {
    this.reqSub?.unsubscribe();
    this.failed.set(false);
    if (this.pagination()) this.refreshing.set(true);
    else this.loading.set(true);

    let params = new HttpParams()
      .set('rentType', this.rentType())
      .set('sort', this.sort())
      .set('page', this.page())
      .set('limit', 12);
    if (this.citySlug()) params = params.set('city', this.citySlug());
    if (this.propertyType()) params = params.set('type', this.propertyType());
    if (this.gender()) params = params.set('gender', this.gender());
    if (this.minPrice()) params = params.set('min', this.minPrice()!);
    if (this.maxPrice()) params = params.set('max', this.maxPrice()!);
    if (this.q().trim()) params = params.set('q', this.q().trim());

    this.reqSub = this.http.get<SearchResponse>(`${environment.apiUrl}/home/search`, { params }).subscribe({
      next: (res) => {
        this.properties.set(res.properties || []);
        this.pagination.set(res.pagination);
        this.priceUnit.set(res.priceUnit);
        if (res.dailySupported === false) this.dailySupported.set(false);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.failed.set(true);
      },
    });
  }

  retry(): void {
    this.runSearch();
  }

  // ── Display helpers ─────────────────────────────────────
  pretty(v: string): string {
    const s = String(v || '').replace(/[_-]/g, ' ');
    if (s.toLowerCase() === 'pg') return 'PG';
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  genderLabel(v: string): string {
    const g = String(v || '').toLowerCase();
    if (/female|girl|women/.test(g)) return 'Girls';
    if (/male|boy|men/.test(g)) return 'Boys';
    if (/unisex|co.?ed|both|any|all/.test(g)) return 'Anyone';
    return this.pretty(v);
  }

  foodLabel(c: Card): string | null {
    if (!c.food) return null;
    if (!c.food.available) return 'No meals';
    return c.food.included ? 'Meals included' : 'Meals extra';
  }

  viewProperty(id: number): void {
    this.router.navigate(['/properties', id]);
  }
}
