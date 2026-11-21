// properties.ts  →  route: /properties   (also opened by the home page search: /properties?q=Belapur)
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environment';
import { AuthService } from '../../core/services/auth.service';
import { UserListsService } from '../../core/services/user-lists.service';

interface Property {
  id: number;
  name: string;
  type: string;
  category: string;          // worked out from the rent
  location: string;
  city: string;
  address: string | null;
  distance: string | null;
  price: number;
  deposit: number;
  verified: boolean;
  featured: boolean;
  rating: number;
  reviews: number;
  image: string | null;
  gallery: string[];
  amenities: string[];
  description: string;
  created_at: string | null;
  gender: string;
  room_count: number;
  room_types: string[];
  beds_available: number;
  has_ac: boolean;
  food: { available: boolean; type: string | null; included: boolean } | null;
  owner_name: string | null;
  owner_image: string | null;
}

type SortOption = 'featured' | 'price-low' | 'price-high' | 'rating' | 'newest';

interface Toast {
  id: number;
  message: string;
}

@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties.html',
  styleUrl: './properties.css',
})
export class Properties implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private lists = inject(UserListsService);
  private sub?: Subscription;

  // Signals so the zoneless app re-renders when data arrives
  properties = signal<Property[]>([]);
  loading = signal(true);
  loadError = signal(false);
  toasts = signal<Toast[]>([]);
  private toastCounter = 0;

  whatsappNumber = '917021455426';

  get whatsappLink(): string {
    const message = 'Hi! I found your listings on HostelKhojo and would like to know more.';
    return `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  // Toolbar state (signals so filtering reacts instantly)
  searchQuery = signal('');
  selectedCategory = signal('All');
  sortBy = signal<SortOption>('featured');

  categories: string[] = ['All', 'Budget', 'Standard', 'Premium', 'Luxury'];

  sortOptions: { value: SortOption; label: string }[] = [
    { value: 'featured', label: 'Verified First' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'newest', label: 'Newest Listed' },
  ];

  ngOnInit(): void {
    // ?q= from the home page search (updates if the user searches again)
    this.sub = this.route.queryParamMap.subscribe((params) => {
      this.searchQuery.set(params.get('q') || '');
    });
    this.loadProperties();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadProperties(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.http.get<{ properties: Omit<Property, 'category'>[] }>(`${environment.apiUrl}/home/properties`).subscribe({
      next: (res) => {
        this.properties.set((res.properties || []).map((p) => ({ ...p, category: this.categoryFor(p.price) })));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  /** Budget / Standard / Premium / Luxury by monthly rent per bed */
  private categoryFor(price: number): string {
    if (!price) return 'Standard';
    if (price < 6000) return 'Budget';
    if (price < 10000) return 'Standard';
    if (price < 16000) return 'Premium';
    return 'Luxury';
  }

  // ---- Derived stats for header ----
  verifiedCount = computed(() => this.properties().filter((p) => p.verified).length);
  bedsFree = computed(() => this.properties().reduce((n, p) => n + (p.beds_available || 0), 0));

  // ---- Filtering + sorting ----
  filteredProperties = computed(() => {
    const words = this.searchQuery().trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
    const cat = this.selectedCategory();

    let result = this.properties().filter((p) => {
      if (cat !== 'All' && p.category !== cat) return false;
      if (!words.length) return true;
      const haystack = [p.name, p.location, p.city, p.address, p.type, p.gender, p.distance, ...p.amenities]
        .filter(Boolean).join(' ').toLowerCase();
      return words.every((w) => haystack.includes(w));
    });

    result = [...result];
    switch (this.sortBy()) {
      case 'price-low':
        result.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() || b.id - a.id);
        break;
      case 'featured':
      default:
        result.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified));
        break;
    }
    return result;
  });

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('All');
    this.sortBy.set('featured');
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  countForCategory(category: string): number {
    if (category === 'All') return this.properties().length;
    return this.properties().filter((p) => p.category === category).length;
  }

  // ---- Display helpers ----
  place(p: Property): string {
    return [p.location, p.city].filter(Boolean).join(', ') || p.address || 'Location on request';
  }

  postedAgo(p: Property): string {
    if (!p.created_at) return '';
    const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
    if (days <= 0) return 'Listed today';
    if (days === 1) return 'Listed yesterday';
    if (days < 7) return `Listed ${days} days ago`;
    if (days < 30) return `Listed ${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
    return `Listed ${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  }

  foodLabel(p: Property): string {
    if (!p.food) return 'Ask about food';
    if (!p.food.available) return 'No meals';
    const t = p.food.type === 'veg' ? 'Veg meals' : p.food.type === 'both' ? 'Veg & non-veg' : p.food.type === 'non-veg' ? 'Non-veg meals' : 'Meals';
    return p.food.included ? `${t} included` : `${t} (extra)`;
  }

  ownerInitial(p: Property): string {
    return (p.owner_name || 'O').charAt(0).toUpperCase();
  }

  // ---- Actions ----
  viewPropertyDetails(propertyId: number): void {
    this.router.navigate(['/properties', propertyId]);
  }

  toggleWishlist(event: Event, property: Property): void {
    event.stopPropagation();
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const wasSaved = this.lists.isFavorite(property.id);
    this.lists.toggleFavorite(property.id).subscribe({
      next: () => this.showToast(wasSaved ? `Removed "${property.name}" from saved hostels` : `Saved "${property.name}"`),
      error: () => this.showToast('Could not update saved hostels. Try again.'),
    });
  }

  isWishlisted(propertyId: number): boolean {
    return this.lists.isFavorite(propertyId);
  }

  /** Opens WhatsApp with the property name filled in */
  contactOwner(event: Event, property: Property): void {
    event.stopPropagation();
    const msg = `Hi! I'm interested in "${property.name}" (${this.place(property)}) on HostelKhojo. Is a bed available?`;
    window.open(`https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  }

  /** Booking / visit enquiry lives on the detail page */
  scheduleVisit(event: Event, property: Property): void {
    event.stopPropagation();
    this.router.navigate(['/properties', property.id]);
  }

  // ---- Toast helper ----
  showToast(message: string): void {
    const id = ++this.toastCounter;
    this.toasts.set([...this.toasts(), { id, message }]);
    setTimeout(() => this.dismissToast(id), 3200);
  }

  dismissToast(id: number): void {
    this.toasts.set(this.toasts().filter((t) => t.id !== id));
  }

  getStarArray(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }

  hasHalfStar(rating: number): boolean {
    return rating % 1 >= 0.5;
  }

  trackByPropertyId(index: number, property: Property): number {
    return property.id;
  }
}
