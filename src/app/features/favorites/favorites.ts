// features/favorites/favorites.ts  →  route: /favorites
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserListsService } from '../../core/services/user-lists.service';
import { PROPERTY_DETAIL_ROUTE, PropertyView, toPropertyView } from '../../core/utils/property-view';

interface SavedItem {
  propertyId: number;
  savedAt: string | null;
  property: PropertyView;
}

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorites.html',
  styleUrls: ['./favorites.css'],
})
export class Favorites implements OnInit {
  auth = inject(AuthService);
  private lists = inject(UserListsService);
  private router = inject(Router);

  readonly detailRoute = PROPERTY_DETAIL_ROUTE;

  loading = signal(true);
  error = signal<string | null>(null);
  private items = signal<SavedItem[]>([]);
  removing = signal<Set<number>>(new Set());

  /** Hide items the moment they're un-saved (also from other pages / heart buttons) */
  saved = computed(() => {
    const ids = this.lists.favoriteIds();
    return this.items().filter((i) => ids.has(i.propertyId));
  });

  ngOnInit(): void {
    if (!this.auth.isBrowser) return;

    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/favorites' } });
      return;
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.lists.getFavorites().subscribe({
      next: (rows) => {
        this.items.set(
          rows.map((r) => ({
            propertyId: Number(r.property_id),
            savedAt: r.saved_at,
            property: toPropertyView(r.property),
          }))
        );
        // make sure the live id set includes everything we just loaded
        this.lists.favoriteIds.set(new Set(rows.map((r) => Number(r.property_id))));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Could not load your saved hostels.');
        this.loading.set(false);
      },
    });
  }

  remove(item: SavedItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const busy = new Set(this.removing());
    busy.add(item.propertyId);
    this.removing.set(busy);

    this.lists.removeFavorite(item.propertyId).subscribe({
      next: () => {
        this.items.set(this.items().filter((i) => i.propertyId !== item.propertyId));
        this.clearRemoving(item.propertyId);
      },
      error: () => {
        this.clearRemoving(item.propertyId);
        this.error.set('Could not remove that hostel. Please try again.');
      },
    });
  }

  private clearRemoving(id: number): void {
    const busy = new Set(this.removing());
    busy.delete(id);
    this.removing.set(busy);
  }
}
