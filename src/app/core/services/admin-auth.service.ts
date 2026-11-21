// core/services/admin-auth.service.ts
// Property OWNER session (rows in the `admins` table).
// Separate from tenants (hk_token) and the super admin (hk_super_token).
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environment';

export const ADMIN_LOGIN_ROUTE = '/register-your-hostel';
export const ADMIN_DASHBOARD_ROUTE = '/owner/dashboard';

const ADMIN_TOKEN_KEY = 'hk_admin_token';
const ADMIN_KEY = 'hk_admin';

export interface HkAdmin {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // must come after isBrowser
  currentAdmin = signal<HkAdmin | null>(this.loadAdmin());

  // "Remember me" → localStorage, otherwise sessionStorage
  private read(key: string): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }
  private write(key: string, value: string, remember: boolean): void {
    if (this.isBrowser) (remember ? localStorage : sessionStorage).setItem(key, value);
  }
  private clear(key: string): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  private loadAdmin(): HkAdmin | null {
    const raw = this.read(ADMIN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return this.read(ADMIN_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  authHeader(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private saveSession(res: any, fallbackEmail: string, remember: boolean): HkAdmin {
    const token: string | undefined = res?.token ?? res?.data?.token;
    const raw = res?.admin ?? res?.user ?? res?.data?.admin ?? {};
    if (!token) throw { error: { message: res?.message || 'No token received.' } };

    const admin: HkAdmin = {
      id: raw.id,
      name: raw.full_name || raw.name || 'Owner',
      email: raw.email || fallbackEmail,
      phone: raw.phone,
      role: 'owner',
    };
    this.clear(ADMIN_TOKEN_KEY);
    this.clear(ADMIN_KEY);
    this.write(ADMIN_TOKEN_KEY, token, remember);
    this.write(ADMIN_KEY, JSON.stringify(admin), remember);
    this.currentAdmin.set(admin);
    return admin;
  }

  /** POST /api/admin/auth/login (your existing owner login) */
  login(email: string, password: string, remember: boolean): Observable<HkAdmin> {
    return this.http
      .post<any>(`${this.base}/admin/auth/login`, { email, password })
      .pipe(map((res) => this.saveSession(res, email, remember)));
  }

  /** POST /api/owner/register — account is approved instantly and logged in */
  register(payload: { full_name: string; email: string; phone: string; password: string }): Observable<HkAdmin> {
    return this.http
      .post<any>(`${this.base}/owner/register`, payload)
      .pipe(map((res) => this.saveSession(res, payload.email, true)));
  }

  logout(): void {
    this.clear(ADMIN_TOKEN_KEY);
    this.clear(ADMIN_KEY);
    this.currentAdmin.set(null);
  }
}
