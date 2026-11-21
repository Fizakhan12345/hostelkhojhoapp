import { AfterViewInit, Component, ElementRef, OnInit, OnDestroy, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environment';

interface Property {
  id: number;
  name: string;
  location: string;
  city: string;
  price: number;
  image: string | null;
  rating: number;
  reviews: number;
  type: string;
  gender: string;
  amenities: string[];
  distance?: string | null;
  verified: boolean;
  beds_available?: number;
  food?: { available: boolean; type: string | null; included: boolean } | null;
  room_types?: string[];
}

interface Testimonial {
  name: string;
  property: string;
  location: string;
  rating: number;
  review: string;
  avatar: string;
}

interface City {
  name: string;
  count: number | null; // null = no count to show yet
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private host = inject(ElementRef<HTMLElement>);
  private revealObserver?: IntersectionObserver;

  searchLocation: string = '';
  selectedGender: string = 'all';
  selectedPropertyType: string = 'all';

  // Shown until the database has listings in these cities
  private readonly fallbackCities: City[] = [
    'Mumbai', 'Navi Mumbai', 'Bengaluru', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata',
  ].map((name) => ({ name, count: null }));

  // ── Real data from the database (signals so the zoneless app re-renders) ──
  popularCities = signal<City[]>(this.fallbackCities);
  featuredProperties = signal<Property[]>([]);
  featuredLoading = signal(true);
  featuredError = signal(false);

  testimonials: Testimonial[] = [
    {
      name: 'Priya Sharma',
      property: 'The Urban Nest',
      location: 'Mumbai',
      rating: 5,
      review: 'Wonderful PG with a friendly atmosphere! The rooms are well-maintained and housekeeping is regular. Felt safe and comfortable throughout my stay.',
      avatar: 'PS'
    },
    {
      name: 'Rahul Mehta',
      property: 'Koramangala Collective',
      location: 'Bengaluru',
      rating: 4,
      review: 'Great hostel for bachelors! The owner is very cooperative and the rent is reasonable. Close to metro which makes daily commute easy.',
      avatar: 'RM'
    },
    {
      name: 'Sneha Desai',
      property: 'Hinjewadi Comfort Stay',
      location: 'Pune',
      rating: 5,
      review: 'Perfect place for working professionals! The facilities are excellent, rooms are clean, and the environment is peaceful.',
      avatar: 'SD'
    },
    {
      name: 'Amit Patel',
      property: 'Gachibowli Green Stay',
      location: 'Hyderabad',
      rating: 4,
      review: 'Had a pleasant stay! The staff is attentive and the services are prompt. A peaceful environment, ideal for studying after work.',
      avatar: 'AP'
    }
  ];

  features = [
    {
      icon: '✓',
      title: 'Verified Listings',
      description: 'Every property is physically verified by our team for quality, safety, and cleanliness, with authentic photos.'
    },
    {
      icon: '🔒',
      title: 'Secure Transactions',
      description: 'Our encrypted payment gateway ensures 100% secure bookings with payment protection and digital agreements.'
    },
    {
      icon: '₹',
      title: 'Zero Brokerage',
      description: 'Connect directly with property owners. Pay only a small 20% fee on first month’s rent. No hidden charges.'
    },
    {
      icon: '📞',
      title: '24/7 Support',
      description: 'Get round-the-clock assistance for any issues or questions from our dedicated support team.'
    },
    {
      icon: '🏠',
      title: 'Pan-India Selection',
      description: 'Choose from 700+ verified properties across 25+ Indian cities, including PGs, hostels, and co-living spaces.'
    },
    {
      icon: '⚡',
      title: 'Quick Booking',
      description: 'Book your perfect accommodation in minutes with our seamless and hassle-free booking process.'
    }
  ];

  stats = [
    { value: '10,000+', label: 'Happy Tenants' },
    { value: '700+', label: 'Verified Properties' },
    { value: '25+', label: 'Cities Across India' },
    { value: '4.8', label: 'Average Rating' }
  ];

  currentTestimonialIndex = signal(0);

  // ── Hero listing deck: real listings with photos, cycling every few seconds ──
  heroSlides = computed(() => this.featuredProperties().filter((p) => !!p.image).slice(0, 5));
  heroIndex = signal(0);
  heroPaused = signal(false);

  private carouselTimer?: ReturnType<typeof setInterval>;
  private heroTimer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    this.loadFeatured();
    this.loadCities();
    if (this.isBrowser) {
      this.startTestimonialCarousel();
      this.startHeroDeck();
    }
  }

  ngAfterViewInit() {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    const root: HTMLElement = this.host.nativeElement;
    root.classList.add('reveal-ready');
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          this.revealObserver?.unobserve(e.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    root.querySelectorAll('.reveal').forEach((el) => this.revealObserver!.observe(el));
  }

  ngOnDestroy() {
    if (this.carouselTimer) {
      clearInterval(this.carouselTimer);
    }
    if (this.heroTimer) {
      clearInterval(this.heroTimer);
    }
    this.revealObserver?.disconnect();
  }

  // ── Hero deck ───────────────────────────────────────────
  private startHeroDeck(): void {
    this.heroTimer = setInterval(() => {
      const n = this.heroSlides().length;
      if (n < 2 || this.heroPaused()) return;
      this.heroIndex.set((this.heroIndex() + 1) % n);
    }, 3000);
  }

  /** Position of a card in the stacked deck: front, behind, further, leaving or hidden. */
  deckPos(i: number): string {
    const n = this.heroSlides().length;
    const offset = (i - (this.heroIndex() % n) + n) % n;
    if (offset === 0) return 'pos-0';
    if (n > 2 && offset === n - 1) return 'pos-out';
    if (offset === 1) return 'pos-1';
    if (offset === 2) return 'pos-2';
    return 'pos-hidden';
  }

  showHeroSlide(i: number): void {
    this.heroIndex.set(i);
  }

  /** Landmark illustration for each city card (files in public/city-art/). */
  private readonly cityArtFiles: Record<string, string> = {
    mumbai: 'mumbai', bombay: 'mumbai',
    'navi-mumbai': 'navi-mumbai', 'cbd-belapur': 'navi-mumbai', vashi: 'navi-mumbai', kharghar: 'navi-mumbai', panvel: 'navi-mumbai',
    bengaluru: 'bengaluru', bangalore: 'bengaluru',
    'delhi-ncr': 'delhi-ncr', delhi: 'delhi-ncr', 'new-delhi': 'delhi-ncr', noida: 'delhi-ncr', gurgaon: 'delhi-ncr', gurugram: 'delhi-ncr',
    pune: 'pune',
    hyderabad: 'hyderabad', secunderabad: 'hyderabad',
    chennai: 'chennai', madras: 'chennai',
    kolkata: 'kolkata', calcutta: 'kolkata', howrah: 'kolkata',
  };

  cityArt(name: string): string {
    const file = this.cityArtFiles[this.citySlug(name)] || 'default';
    return `url(/city-art/${file}.svg)`;
  }

  /** City cards open that city's page (/cities/:slug). */
  citySlug(name: string): string {
    return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ── Data ────────────────────────────────────────────────
  loadFeatured(): void {
    this.featuredLoading.set(true);
    this.featuredError.set(false);
    this.http.get<{ properties: Property[] }>(`${environment.apiUrl}/home/featured?limit=6`).subscribe({
      next: (res) => {
        this.featuredProperties.set(res.properties || []);
        this.featuredLoading.set(false);
      },
      error: () => {
        this.featuredLoading.set(false);
        this.featuredError.set(true);
      }
    });
  }

  private loadCities(): void {
    this.http.get<{ cities: City[] }>(`${environment.apiUrl}/home/cities`).subscribe({
      next: (res) => {
        const real = (res.cities || []).filter((c) => c.name);
        if (!real.length) return; // keep the fallback names
        // real cities first, then fallback names that aren't listed yet
        const seen = new Set(real.map((c) => c.name.toLowerCase()));
        const rest = this.fallbackCities.filter((c) => !seen.has(c.name.toLowerCase()));
        this.popularCities.set([...real, ...rest].slice(0, 8));
      },
      error: () => {} // keep fallback names
    });
  }

  // ── Carousel ────────────────────────────────────────────
  startTestimonialCarousel() {
    this.carouselTimer = setInterval(() => {
      const next = (this.currentTestimonialIndex() + 1) % this.testimonials.length;
      this.currentTestimonialIndex.set(next);
    }, 5000);
  }

  goToTestimonial(index: number): void {
    this.currentTestimonialIndex.set(index);
  }

  // ── Search → Properties page, filtered by what was typed ──
  onSearch() {
    const q = this.searchLocation.trim();
    this.router.navigate(['/properties'], { queryParams: q ? { q } : {} });
  }

  searchByLocation(location: string) {
    this.searchLocation = location;
    this.onSearch();
  }

  getStarArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.floor(rating));
  }
}
