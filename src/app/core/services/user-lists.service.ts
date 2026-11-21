// core/services/user-lists.service.ts
// Saved hostels + my bookings. Keeps a live set of saved ids so every ❤️ button stays in sync.
import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserListsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = `${environment.apiUrl}/me`;

  /** ids of hostels the user has saved */
  favoriteIds = signal<Set<number>>(new Set());

  private loadedForUser: number | null = null;

  constructor() {
    // Load saved ids on login, clear on logout
    effect(() => {
      const user = this.auth.currentUser();
      if (!user) {
        this.loadedForUser = null;
        this.favoriteIds.set(new Set());
        return;
      }
      if (this.auth.isBrowser && this.loadedForUser !== user.id) {
        this.loadedForUser = user.id;
        this.refreshFavoriteIds();
      }
    });
  }

  private opts() {
    return { headers: this.auth.authHeader() };
  }

  // ── Favourites ─────────────────────────────────────────
  refreshFavoriteIds(): void {
    this.http.get<{ success: boolean; ids: number[] }>(`${this.base}/favorites/ids`, this.opts()).subscribe({
      next: (res) => this.favoriteIds.set(new Set(res.ids || [])),
      error: () => {},
    });
  }

  isFavorite(propertyId: number | string): boolean {
    return this.favoriteIds().has(Number(propertyId));
  }

  getFavorites(): Observable<any[]> {
    return this.http
      .get<{ success: boolean; favorites: any[] }>(`${this.base}/favorites`, this.opts())
      .pipe(map((res) => res.favorites || []));
  }

  addFavorite(propertyId: number | string): Observable<any> {
    const id = Number(propertyId);
    this.setLocal(id, true); // optimistic
    return this.http.post(`${this.base}/favorites/${id}`, {}, this.opts()).pipe(
      tap({ error: () => this.setLocal(id, false) })
    );
  }

  removeFavorite(propertyId: number | string): Observable<any> {
    const id = Number(propertyId);
    this.setLocal(id, false); // optimistic
    return this.http.delete(`${this.base}/favorites/${id}`, this.opts()).pipe(
      tap({ error: () => this.setLocal(id, true) })
    );
  }

  toggleFavorite(propertyId: number | string): Observable<any> {
    return this.isFavorite(propertyId) ? this.removeFavorite(propertyId) : this.addFavorite(propertyId);
  }

  private setLocal(id: number, saved: boolean): void {
    const next = new Set(this.favoriteIds());
    saved ? next.add(id) : next.delete(id);
    this.favoriteIds.set(next);
  }

  // ── Bookings ───────────────────────────────────────────
  getMyBookings(): Observable<any[]> {
    return this.http
      .get<{ success: boolean; bookings: any[] }>(`${this.base}/bookings`, this.opts())
      .pipe(map((res) => res.bookings || []));
  }
}
