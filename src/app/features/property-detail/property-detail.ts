import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { FavoriteButton } from '../../shared/favorite-button/favorite-button';
import { PropertyExtras } from '../../shared/property-extras/property-extras';
import { SeoService } from '../../core/services/seo.service';

/** How long each photo stays on screen before the slider moves on. */
const SLIDE_MS = 2000;

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FavoriteButton, PropertyExtras],
  templateUrl: './property-detail.html',
  styleUrls: ['./property-detail.css'],
})
export class PropertyDetail implements OnInit {
  property = signal<any>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  activeImageIndex = signal(0);
  favBusy = signal(false);

  // ── Photo slider state ──────────────────────────────────────
  readonly slideMs = SLIDE_MS;
  /** The photo that is sliding out (null when nothing is moving). */
  leavingImageIndex = signal<number | null>(null);
  /** Which way the photos move: 'next' slides left, 'prev' slides right. */
  slideDir = signal<'next' | 'prev'>('next');
  /** Paused by the pause button. */
  userPaused = signal(false);
  /** Paused while the pointer or keyboard focus is on the gallery. */
  hovering = signal(false);

  images = computed<any[]>(() => this.property()?.images ?? []);
  activeImage = computed(() => this.images()[this.activeImageIndex()] ?? null);
  isPlaying = computed(
    () =>
      this.isBrowser &&
      this.images().length > 1 &&
      !this.userPaused() &&
      !this.hovering() &&
      !this.showBookingModal()
  );

  @ViewChild('thumbStrip') thumbStrip?: ElementRef<HTMLElement>;

  // ── Booking dialog state ────────────────────────────────────
  // Book Now never requires login — it opens this dialog directly,
  // collects contact details, and emails everyone involved.
  showBookingModal = signal(false);
  bookingSubmitting = signal(false);
  bookingError = signal<string | null>(null);
  bookingSuccess = signal<any>(null);
  selectedRoomId: number | null = null;

  form = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    checkInDate: '',
    durationMonths: 1,
  };

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private seo = inject(SeoService);
  private touchStartX: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
  ) {
    // Autoplay: every time the photo changes (or play resumes), wait
    // SLIDE_MS and move to the next one. Stops on hover, pause and modal.
    effect((onCleanup) => {
      if (!this.isPlaying()) return;
      const current = this.activeImageIndex();
      const t = setTimeout(() => this.goTo(current + 1, 'next'), SLIDE_MS);
      onCleanup(() => clearTimeout(t));
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Property not found.');
      this.loading.set(false);
      return;
    }
    this.api.getPropertyById(id).subscribe({
      next: (res) => {
        this.property.set(res.data);
        this.applySeo(res.data);
        this.activeImageIndex.set(0);
        this.leavingImageIndex.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        // a listing that no longer exists should drop out of Google
        if (err?.status === 404) {
          this.seo.update({ title: 'Listing not found | HostelKhojo', description: 'This listing is no longer available.', index: false });
        }
        this.error.set('We couldn’t load this property. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ── Slider ──────────────────────────────────────────────────

  /** Thumbnail click (kept from the old page). */
  setActiveImage(i: number): void {
    const cur = this.activeImageIndex();
    if (i === cur) return;
    this.goTo(i, i > cur ? 'next' : 'prev');
  }

  next(): void {
    this.goTo(this.activeImageIndex() + 1, 'next');
  }

  prev(): void {
    this.goTo(this.activeImageIndex() - 1, 'prev');
  }

  goTo(index: number, dir: 'next' | 'prev'): void {
    const n = this.images().length;
    if (n < 2) return;
    const target = ((index % n) + n) % n;
    const cur = this.activeImageIndex();
    if (target === cur) return;
    this.slideDir.set(dir);
    this.leavingImageIndex.set(cur);
    this.activeImageIndex.set(target);
    this.scrollThumbIntoView(target);
  }

  togglePlay(): void {
    this.userPaused.update((v) => !v);
  }

  slideState(i: number): string {
    if (i === this.activeImageIndex()) return 'is-active';
    if (i === this.leavingImageIndex()) return 'is-leaving';
    return '';
  }

  /** Photos near the current one load right away; the rest load lazily. */
  loadingFor(i: number): 'eager' | 'lazy' {
    const n = this.images().length;
    const a = this.activeImageIndex();
    return i === a || i === (a + 1) % n || i === (a - 1 + n) % n ? 'eager' : 'lazy';
  }

  imageLabel(img: any): string {
    return img?.caption || img?.category || '';
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.changedTouches[0]?.clientX ?? null;
  }

  onTouchEnd(e: TouchEvent): void {
    if (this.touchStartX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(dx) < 40) return;
    dx < 0 ? this.next() : this.prev();
  }

  private scrollThumbIntoView(i: number): void {
    const strip = this.thumbStrip?.nativeElement;
    const thumb = strip?.children[i] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({
      left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2,
      behavior: 'smooth',
    });
  }

  // Favorite icon: works only for logged-in users. Anonymous visitors
  // are redirected to /login with a returnUrl back to this page.
  toggleFavorite(): void {
    const prop = this.property();
    if (!prop) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.favBusy.set(true);
    const wasFav = prop.is_favorited;
    const call = wasFav ? this.api.removeFavorite(prop.id) : this.api.addFavorite(prop.id);

    call.subscribe({
      next: () => {
        this.property.set({ ...prop, is_favorited: !wasFav });
        this.favBusy.set(false);
      },
      error: () => {
        this.favBusy.set(false);
      },
    });
  }

  // ── Booking dialog ──────────────────────────────────────────

  /** Sidebar / mobile bar button: books the first room that still has beds. */
  bookFirstRoom(): void {
    const rooms: any[] = this.property()?.rooms || [];
    const room = rooms.find((r) => Number(r.available) > 0) || rooms[0];
    if (room) this.openBookingModal(room.id);
  }

  /** Little bed marks on each room card (1–4, by sharing count). */
  bedSlots(capacity: any): number[] {
    const n = Math.min(Math.max(Number(capacity) || 1, 1), 4);
    return Array.from({ length: n }, (_, i) => i);
  }

  hasFreeBeds(p: any): boolean {
    return (p?.rooms || []).some((r: any) => Number(r.available) > 0);
  }

  // "Book Now" / "Book This Property" opens the dialog directly — no
  // login redirect. Prefills a sensible default check-in date.
  openBookingModal(roomId: number): void {
    this.selectedRoomId = roomId;
    this.bookingError.set(null);
    this.bookingSuccess.set(null);

    if (!this.form.checkInDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.form.checkInDate = tomorrow.toISOString().slice(0, 10);
    }
    this.showBookingModal.set(true);
  }

  closeBookingModal(): void {
    this.showBookingModal.set(false);
    this.bookingError.set(null);
  }

  get selectedRoom(): any {
    const p = this.property();
    if (!p || !this.selectedRoomId) return null;
    return (p.rooms || []).find((r: any) => r.id === this.selectedRoomId) || null;
  }

  submitBooking(): void {
    const p = this.property();
    if (!p || !this.selectedRoomId) return;

    if (!this.form.fullName || !this.form.email || !this.form.phone) {
      this.bookingError.set('Please fill in your name, email and phone number.');
      return;
    }

    this.bookingSubmitting.set(true);
    this.bookingError.set(null);

    this.api.createBooking({
      property_id: p.id,
      room_id: this.selectedRoomId,
      check_in_date: this.form.checkInDate,
      duration_months: this.form.durationMonths,
      full_name: this.form.fullName,
      email: this.form.email,
      phone: this.form.phone,
      address: this.form.address,
      city: this.form.city,
    }).subscribe({
      next: (res: { data: any; }) => {
        this.bookingSuccess.set(res.data);
        this.bookingSubmitting.set(false);
      },
      error: (err: { error: { message: any; }; }) => {
        this.bookingError.set(err?.error?.message || 'Something went wrong. Please try again.');
        this.bookingSubmitting.set(false);
      },
    });
  }

  // ── SEO: title, description, share preview and Google structured data ──
  private applySeo(p: any): void {
    if (!p) return;
    const place = [p.area, p.city].filter(Boolean).join(', ');
    const type = String(p.property_type || 'Hostel').toLowerCase() === 'pg' ? 'PG' : this.titleCase(p.property_type || 'Hostel');
    const gender = String(p.gender_allowed || '').toLowerCase();
    const forWho = /female|girl|women/.test(gender) ? 'for Girls' : /male|boy|men/.test(gender) ? 'for Boys' : '';
    const rooms: any[] = p.rooms || [];
    const prices = rooms.map((r) => Number(r.price_per_bed)).filter((n) => n > 0);
    const from = Math.min(...(prices.length ? prices : [Number(p.monthly_rent) || 0]));
    const to = Math.max(...(prices.length ? prices : [Number(p.monthly_rent) || 0]));
    const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
    const amenityNames: string[] = (p.amenities || []).map((a: any) => a?.name || a).filter(Boolean);
    const images: string[] = (p.images || []).map((i: any) => i?.image_url).filter(Boolean);
    const path = `/properties/${p.id}`;

    this.seo.update({
      title: `${p.name} — ${type} ${forWho} in ${place || p.city || 'India'}${from ? ` from ${rupees(from)}/month` : ''}`.replace(/\s+/g, ' '),
      description:
        `${p.name}: ${p.is_verified ? 'verified ' : ''}${type} ${forWho} in ${place}. ` +
        (from ? `Rent from ${rupees(from)}/month. ` : '') +
        (amenityNames.length ? `${amenityNames.slice(0, 5).join(', ')}. ` : '') +
        'See photos and rooms, then book with zero brokerage.',
      path,
      image: images[0] || null,
      type: 'place',
    });

    const ld: any = {
      '@context': 'https://schema.org',
      '@type': 'Hostel',
      '@id': this.seo.absolute(path) + '#listing',
      name: p.name,
      url: this.seo.absolute(path),
      description: String(p.description || '').slice(0, 500) || undefined,
      image: images.slice(0, 10).map((u) => this.seo.absolute(u)),
      address: {
        '@type': 'PostalAddress',
        streetAddress: p.address || p.area || undefined,
        addressLocality: p.city || undefined,
        addressRegion: p.state || undefined,
        postalCode: p.pincode || p.postal_code || undefined,
        addressCountry: 'IN',
      },
      priceRange: from ? (from === to ? `${rupees(from)} per month` : `${rupees(from)} – ${rupees(to)} per month`) : undefined,
      currenciesAccepted: 'INR',
      amenityFeature: amenityNames.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
      makesOffer: rooms
        .filter((r) => Number(r.price_per_bed) > 0)
        .map((r) => ({
          '@type': 'Offer',
          name: `${this.titleCase(r.room_type || 'Room')} — per bed`,
          price: Number(r.price_per_bed),
          priceCurrency: 'INR',
          availability: Number(r.available) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          priceSpecification: { '@type': 'UnitPriceSpecification', price: Number(r.price_per_bed), priceCurrency: 'INR', unitText: 'MONTH' },
        })),
    };
    if (p.latitude && p.longitude) {
      ld.geo = { '@type': 'GeoCoordinates', latitude: Number(p.latitude), longitude: Number(p.longitude) };
    }
    // Only real reviews — Google penalises ratings without reviews behind them
    if (Number(p.total_reviews) > 0 && Number(p.avg_rating) > 0) {
      ld.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Number(p.avg_rating).toFixed(1),
        reviewCount: Number(p.total_reviews),
        bestRating: 5,
        worstRating: 1,
      };
      ld.review = (p.reviews || []).slice(0, 5).map((r: any) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.full_name || 'Resident' },
        reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
        name: r.title || undefined,
        reviewBody: r.comment || undefined,
      }));
    }
    this.seo.setJsonLd('listing', ld);

    const crumbs: Array<[string, string]> = [['Home', '/'], ['Properties', '/properties']];
    if (p.city) crumbs.push([p.city, '/cities/' + this.slugify(p.city)]);
    crumbs.push([p.name, path]);
    this.seo.breadcrumbs(crumbs);
  }

  private titleCase(v: string): string {
    return String(v || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private slugify(v: string): string {
    return String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  getStarArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.round(rating));
  }
}
