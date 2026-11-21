// core/services/owner.service.ts — everything the owner dashboard calls
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environment';
import { AdminAuthService } from './admin-auth.service';

export interface OwnerPlan {
  code: 'free' | 'pro' | 'business';
  name: string;
  price: number;
  listings: number;
  days: number | null;
  ends_at?: string | null;
}

export interface OwnerMe {
  owner: { id: number; full_name: string; email: string; phone: string };
  plan: OwnerPlan;
  usage: { listings: number; limit: number; remaining: number };
}

export interface OwnerMeta {
  cities: { id: number; name: string; state: string | null }[];
  amenities: { id: number; name: string; icon: string | null }[];
  usesCityId: boolean;
  options: { property_type: string[]; gender_allowed: string[]; room_type: string[] | null };
  plans: OwnerPlan[];
  razorpayConfigured: boolean;
  upiConfigured: boolean;
}

export interface EnquirySummary {
  plan: string;
  total: number;
  unlocked: number;
  locked: number;
  free_limit: number | null;
}

export interface UpiIntent {
  plan: OwnerPlan;
  upi_id: string;
  payee: string;
  amount: number;
  note: string;
  link: string;
  qr: string | null;
}

export interface OwnerProperty {
  id: number;
  name: string;
  city?: string;
  area?: string;
  monthly_rent?: number;
  is_verified?: number;
  is_active?: number;
  cover_image: string | null;
  room_count: number;
  beds_available: number;
  enquiry_count: number;
  [key: string]: any;
}

export type PhotoCategory = 'room' | 'amenities' | 'washroom' | 'food' | 'building' | 'other';

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: 'room', label: 'Room' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'washroom', label: 'Washroom' },
  { value: 'food', label: 'Food / kitchen' },
  { value: 'building', label: 'Building / outside' },
  { value: 'other', label: 'Other' },
];

export const MAX_PROPERTY_PHOTOS = 15;

export interface SavedPhoto {
  id: number;
  doc_id: string;
  category: PhotoCategory;
  url: string;
}

export interface RazorpayOrder {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  plan: OwnerPlan;
  prefill: { name: string; email: string; contact: string };
}

@Injectable({ providedIn: 'root' })
export class OwnerService {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);
  private base = `${environment.apiUrl}/owner`;

  private opts() {
    return { headers: this.auth.authHeader() };
  }

  me(): Observable<OwnerMe> {
    return this.http.get<OwnerMe>(`${this.base}/me`, this.opts());
  }

  meta(): Observable<OwnerMeta> {
    return this.http.get<OwnerMeta>(`${this.base}/meta`, this.opts());
  }

  properties(): Observable<OwnerProperty[]> {
    return this.http.get<{ properties: OwnerProperty[] }>(`${this.base}/properties`, this.opts()).pipe(map((r) => r.properties || []));
  }

  /** photos are saved in order; each gets its own doc_id in the property_photos table */
  createProperty(
    data: any,
    photos: { file: File; category: PhotoCategory; caption?: string }[]
  ): Observable<{ property_id: number; photos: SavedPhoto[] }> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(data));
    fd.append('images_meta', JSON.stringify(photos.map((p) => ({ category: p.category, caption: p.caption || '' }))));
    photos.forEach((p) => fd.append('images', p.file));
    return this.http.post<{ property_id: number; photos: SavedPhoto[] }>(`${this.base}/properties`, fd, this.opts());
  }

  enquiries(): Observable<{ enquiries: any[]; summary: EnquirySummary | null }> {
    return this.http
      .get<{ enquiries: any[]; summary?: EnquirySummary }>(`${this.base}/enquiries`, this.opts())
      .pipe(map((r) => ({ enquiries: r.enquiries || [], summary: r.summary || null })));
  }

  /** UPI ID, amount, payment link and QR for paying a plan directly (no gateway fees) */
  upiIntent(plan: string): Observable<UpiIntent> {
    return this.http.get<UpiIntent>(`${this.base}/subscription/upi`, { ...this.opts(), params: { plan } });
  }

  /** Owner reports the UTR after paying; super admin confirms it */
  upiClaim(plan: string, utr: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/subscription/upi`, { plan, utr }, this.opts());
  }

  subscriptions(): Observable<any[]> {
    return this.http.get<{ subscriptions: any[] }>(`${this.base}/subscriptions`, this.opts()).pipe(map((r) => r.subscriptions || []));
  }

  createOrder(plan: string): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>(`${this.base}/subscription/order`, { plan }, this.opts());
  }

  verifyPayment(body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): Observable<any> {
    return this.http.post(`${this.base}/subscription/verify`, body, this.opts());
  }

  /** Public: food / facilities / rules shown on the property detail page */
  extras(propertyId: number | string): Observable<any> {
    return this.http.get<{ extras: any }>(`${this.base}/public/properties/${propertyId}/extras`).pipe(map((r) => r.extras));
  }
}
