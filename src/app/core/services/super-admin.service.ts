// core/services/super-admin.service.ts
// The single hardcoded super admin. Separate from users (hk_token) and hostel owners (hk_admin_token).
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environment';

export const SUPER_ADMIN_LOGIN_ROUTE = '/super-admin/login';
export const SUPER_ADMIN_HOME_ROUTE = '/super-admin/overview';

const TOKEN_KEY = 'hk_super_token';
const PROFILE_KEY = 'hk_super_admin';

export type SaResource = 'rooms' | 'cities' | 'payments';

export interface SuperAdmin {
  name: string;
  email: string;
  role: string;
}

export interface SaField {
  name: string;
  label: string;
  kind: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'datetime' | 'textarea';
  options: string[] | null;
  ref: string | null;
  required: boolean;
  default: any;
}

export interface SaLookupItem {
  id: number;
  label: string;
}

export interface SaSchema {
  table: string;
  creatable: boolean;
  fields: SaField[];
  lookups: Record<string, SaLookupItem[]>;
}

export interface SaStats {
  users: number | null;
  admins: number | null;
  properties: number | null;
  bookings: number | null;
  rooms: number | null;
  cities: number | null;
  payments: number | null;
  pendingListings?: number | null;
  pendingPayments?: number | null;
}

export interface SaPlanPayment {
  id: number;
  owner_id: number;
  owner_name: string;
  owner_email: string | null;
  owner_phone: string | null;
  plan: string;
  plan_name: string;
  amount: number;
  method: 'upi' | 'razorpay';
  reference: string | null;
  status: 'pending' | 'paid' | 'rejected';
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
}

export interface SaListing {
  id: number;
  name: string;
  area: string | null;
  city: string | null;
  property_type: string | null;
  gender_allowed: string | null;
  monthly_rent: number | null;
  created_at: string | null;
  is_verified: boolean;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  cover_image: string | null;
  photo_count: number;
  room_count: number;
}

export interface SaOwner {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  joined_at: string | null;
  listings: number;
  enquiries: number;
  enquiries_30d: number | null;
  enquiries_7d: number | null;
  last_enquiry_at: string | null;
  by_status: Record<string, number>;
  plan: string;
  plan_ends_at: string | null;
}

export interface SaOwnerEnquiry {
  id: number;
  ref: string;
  property_id: number;
  property_name: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_email: string | null;
  move_in: string | null;
  months: number | string | null;
  status: string;
  created_at: string | null;
}

export interface SaListingsResponse {
  canVerify: boolean;
  canHide: boolean;
  properties: SaListing[];
}

export interface SaUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  gender?: string | null;
  profile_pic?: string | null;
  is_verified: number | boolean;
  is_active: number | boolean;
  created_at?: string | null;
  bookings_count: number;
  favorites_count: number;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/super-admin`;
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // must come after isBrowser
  currentAdmin = signal<SuperAdmin | null>(this.loadProfile());

  // sessionStorage: the super admin is logged out when the browser closes
  private get(key: string): string | null {
    return this.isBrowser ? sessionStorage.getItem(key) : null;
  }
  private set(key: string, value: string): void {
    if (this.isBrowser) sessionStorage.setItem(key, value);
  }
  private remove(key: string): void {
    if (this.isBrowser) sessionStorage.removeItem(key);
  }

  private loadProfile(): SuperAdmin | null {
    const raw = this.get(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.get(TOKEN_KEY);
  }

  private opts() {
    const token = this.get(TOKEN_KEY);
    return { headers: token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders() };
  }

  login(email: string, password: string): Observable<SuperAdmin> {
    return this.http.post<{ token: string; admin: SuperAdmin }>(`${this.base}/login`, { email, password }).pipe(
      tap((res) => {
        this.set(TOKEN_KEY, res.token);
        this.set(PROFILE_KEY, JSON.stringify(res.admin));
        this.currentAdmin.set(res.admin);
      }),
      map((res) => res.admin)
    );
  }

  logout(): void {
    this.remove(TOKEN_KEY);
    this.remove(PROFILE_KEY);
    this.currentAdmin.set(null);
  }

  // ── Data ───────────────────────────────────────────────
  stats(): Observable<SaStats> {
    return this.http.get<{ stats: SaStats }>(`${this.base}/stats`, this.opts()).pipe(map((r) => r.stats));
  }

  users(): Observable<SaUser[]> {
    return this.http.get<{ users: SaUser[] }>(`${this.base}/users`, this.opts()).pipe(map((r) => r.users || []));
  }

  setUserActive(id: number, active: boolean): Observable<any> {
    return this.http.patch(`${this.base}/users/${id}/status`, { is_active: active }, this.opts());
  }

  schema(resource: SaResource): Observable<SaSchema> {
    return this.http.get<SaSchema>(`${this.base}/schema/${resource}`, this.opts());
  }

  list(resource: SaResource): Observable<any[]> {
    return this.http.get<{ rows: any[] }>(`${this.base}/data/${resource}`, this.opts()).pipe(map((r) => r.rows || []));
  }

  // ── Listings (approve / hide) ──────────────────────────
  listings(): Observable<SaListingsResponse> {
    return this.http.get<SaListingsResponse>(`${this.base}/properties`, this.opts());
  }

  setVerified(id: number, value: boolean): Observable<any> {
    return this.http.patch(`${this.base}/properties/${id}/verify`, { value }, this.opts());
  }

  setVisible(id: number, value: boolean): Observable<any> {
    return this.http.patch(`${this.base}/properties/${id}/active`, { value }, this.opts());
  }

  // ── Owner plan payments ────────────────────────────────
  planPayments(): Observable<SaPlanPayment[]> {
    return this.http
      .get<{ subscriptions: SaPlanPayment[] }>(`${this.base}/subscriptions`, this.opts())
      .pipe(map((r) => r.subscriptions || []));
  }

  reviewPlanPayment(id: number, action: 'approve' | 'reject'): Observable<any> {
    return this.http.patch(`${this.base}/subscriptions/${id}`, { action }, this.opts());
  }

  // ── Owners & their enquiries ───────────────────────────
  owners(): Observable<{ hasDates: boolean; owners: SaOwner[] }> {
    return this.http.get<{ hasDates: boolean; owners: SaOwner[] }>(`${this.base}/owners`, this.opts());
  }

  ownerEnquiries(ownerId: number): Observable<SaOwnerEnquiry[]> {
    return this.http
      .get<{ enquiries: SaOwnerEnquiry[] }>(`${this.base}/owners/${ownerId}/enquiries`, this.opts())
      .pipe(map((r) => r.enquiries || []));
  }

  create(resource: SaResource, body: Record<string, any>): Observable<any> {
    return this.http.post<{ row: any }>(`${this.base}/data/${resource}`, body, this.opts()).pipe(map((r) => r.row));
  }
}
