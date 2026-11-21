// features/cities-view/city-detail.component.ts  →  route: /cities/:slug
import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environment';
import { SeoService } from '../../core/services/seo.service';

interface CityInfo {
  id: number | null;
  name: string;
  slug: string;
  state: string | null;
  banner_image_url: string | null;
  short_description: string | null;
}

interface CityCard {
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
  room_count: number;
  beds_available: number;
  food: { available: boolean; type: string | null; included: boolean } | null;
}

interface CityResponse {
  city: CityInfo;
  properties: CityCard[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  facets: { types: string[]; genders: string[] };
  stats: { total: number; verified: number; from_price: number };
}

type SortKey = 'newest' | 'rent_low' | 'rent_high' | 'rating';

@Component({
  selector: 'app-city-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './city-detail.component.html',
  styleUrls: ['./city-detail.component.scss'],
})
export class CityDetailComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private seo = inject(SeoService);
  private sub?: Subscription;
  private reqSub?: Subscription;

  // ── State (signals: the zoneless app re-renders as soon as data arrives) ──
  slug = signal('');
  city = signal<CityInfo | null>(null);
  properties = signal<CityCard[]>([]);
  pagination = signal<CityResponse['pagination'] | null>(null);
  facets = signal<CityResponse['facets']>({ types: [], genders: [] });
  stats = signal<CityResponse['stats'] | null>(null);

  loading = signal(true);     // first load (hero + grid)
  refreshing = signal(false); // filter / page change (grid only)
  notFound = signal(false);
  loadError = signal(false);

  type = signal<string>('');
  gender = signal<string>('');
  sort = signal<SortKey>('newest');
  page = signal(1);

  readonly sortOptions: { value: SortKey; label: string }[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'rent_low', label: 'Rent: low to high' },
    { value: 'rent_high', label: 'Rent: high to low' },
    { value: 'rating', label: 'Top rated' },
  ];

  hasFilters = computed(() => !!this.type() || !!this.gender());

  pages = computed(() => {
    const p = this.pagination();
    if (!p || p.totalPages <= 1) return [];
    const out: number[] = [];
    const from = Math.max(1, p.page - 2);
    const to = Math.min(p.totalPages, from + 4);
    for (let i = Math.max(1, to - 4); i <= to; i++) out.push(i);
    return out;
  });

  ngOnInit(): void {
    // paramMap (not snapshot) so jumping between cities from the header menu re-loads
    this.sub = this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const cityChanged = slug !== this.slug();
      this.slug.set(slug);
      if (cityChanged) {
        this.type.set('');
        this.gender.set('');
        this.sort.set('newest');
        this.page.set(1);
        this.city.set(null);
        this.loading.set(true);
      }
      this.fetch();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.reqSub?.unsubscribe();
  }

  private fetch(): void {
    this.reqSub?.unsubscribe();
    this.notFound.set(false);
    this.loadError.set(false);
    if (this.city()) this.refreshing.set(true);

    let params = new HttpParams().set('sort', this.sort()).set('page', this.page()).set('limit', 12);
    if (this.type()) params = params.set('type', this.type());
    if (this.gender()) params = params.set('gender', this.gender());

    this.reqSub = this.http
      .get<CityResponse>(`${environment.apiUrl}/home/city/${encodeURIComponent(this.slug())}`, { params })
      .subscribe({
        next: (res) => {
          this.city.set(res.city);
          this.properties.set(res.properties || []);
          this.pagination.set(res.pagination);
          this.facets.set(res.facets || { types: [], genders: [] });
          this.stats.set(res.stats);
          this.applySeo(res);
          this.loading.set(false);
          this.refreshing.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.refreshing.set(false);
          if (err?.status === 404) {
            this.notFound.set(true);
            this.seo.update({ title: 'City not found | HostelKhojo', description: 'We don’t have stays in this city yet.', index: false });
          }
          else this.loadError.set(true);
        },
      });
  }

  retry(): void {
    this.fetch();
  }

  // ── Filters ─────────────────────────────────────────────
  setType(v: string): void {
    this.type.set(this.type() === v ? '' : v);
    this.page.set(1);
    this.fetch();
  }

  setGender(v: string): void {
    this.gender.set(this.gender() === v ? '' : v);
    this.page.set(1);
    this.fetch();
  }

  setSort(v: SortKey): void {
    this.sort.set(v);
    this.page.set(1);
    this.fetch();
  }

  clearFilters(): void {
    this.type.set('');
    this.gender.set('');
    this.page.set(1);
    this.fetch();
  }

  goToPage(n: number): void {
    const p = this.pagination();
    if (!p || n < 1 || n > p.totalPages || n === p.page) return;
    this.page.set(n);
    this.fetch();
    if (this.isBrowser) {
      document.getElementById('city-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  foodLabel(c: CityCard): string | null {
    if (!c.food) return null;
    if (!c.food.available) return 'No meals';
    return c.food.included ? 'Meals included' : 'Meals extra';
  }

  viewProperty(id: number): void {
    this.router.navigate(['/properties', id]);
  }

  // ── SEO: "Hostels & PGs in Pune" title, description and structured data ──
  private applySeo(res: CityResponse): void {
    const c = res.city;
    if (!c) return;
    const total = res.stats?.total ?? res.pagination?.total ?? 0;
    const from = res.stats?.from_price || 0;
    const path = `/cities/${c.slug || this.slug()}`;
    const filtered = !!(this.type() || this.gender() || this.page() > 1 || this.sort() !== 'newest');

    this.seo.update({
      title: `Hostels & PGs in ${c.name}${total ? ` — ${total} verified stays` : ''}${from ? ` from ₹${from.toLocaleString('en-IN')}` : ''} | HostelKhojo`,
      description:
        c.short_description ||
        `Find ${total || 'verified'} hostels and PG rooms in ${c.name}${c.state ? `, ${c.state}` : ''}` +
          `${from ? ` from ₹${from.toLocaleString('en-IN')}/month` : ''}. Boys, girls and co-living options with food, WiFi and real photos. Zero brokerage.`,
      path, // filters and page numbers all point Google at the main city page
      image: c.banner_image_url || res.properties?.[0]?.image || null,
    });
    if (filtered) return;

    this.seo.setJsonLd('city-list', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Hostels & PGs in ${c.name}`,
      numberOfItems: total,
      itemListElement: (res.properties || []).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: this.seo.absolute(`/properties/${p.id}`),
        name: p.name,
      })),
    });
    this.seo.breadcrumbs([
      ['Home', '/'],
      ['Cities', '/cities'],
      [c.name, path],
    ]);
  }

}
