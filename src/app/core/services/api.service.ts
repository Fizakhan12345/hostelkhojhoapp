import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../../environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private authHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  // ── Properties ────────────────────────────────────────────
  getProperties(filters: Record<string, any> = {}): Observable<any> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get(`${this.base}/properties`, { params, headers: this.authHeaders() });
  }

  getPropertyById(id: number | string): Observable<any> {
    return this.http.get(`${this.base}/properties/${id}`, { headers: this.authHeaders() });
  }

  // ── Favorites (requires login) ──────────────────────────────
  getFavorites(): Observable<any> {
    return this.http.get(`${this.base}/favorites`, { headers: this.authHeaders() });
  }

  addFavorite(propertyId: number | string): Observable<any> {
    return this.http.post(`${this.base}/favorites/${propertyId}`, {}, { headers: this.authHeaders() });
  }

  removeFavorite(propertyId: number | string): Observable<any> {
    return this.http.delete(`${this.base}/favorites/${propertyId}`, { headers: this.authHeaders() });
  }

  createBooking(payload: {
    property_id: number;
    room_id: number;
    check_in_date: string;
    duration_months: number;
    full_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  }): Observable<any> {
    return this.http.post(`${this.base}/bookings`, payload, { headers: this.authHeaders() });
  }

  getMyBookings(): Observable<any> {
    return this.http.get(`${this.base}/bookings/my`, { headers: this.authHeaders() });
  }

  // ── Cities ─────────────────────────────────────────────────
  getCities(featured = false): Observable<any> {
    const params = featured ? new HttpParams().set('featured', '1') : new HttpParams();
    return this.http.get(`${this.base}/cities`, { params });
  }
}