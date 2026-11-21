import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environment';

const TOKEN_KEY = 'hk_token';
const USER_KEY = 'hk_user';

export interface HkUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  gender?: string | null;
  profile_pic?: string | null;
  is_verified: number;
  created_at?: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: HkUser;
}

interface ProfilePictureResponse {
  success: boolean;
  message?: string;
  profile_pic?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** true in the browser, false during server-side rendering */
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // must come AFTER isBrowser
  currentUser = signal<HkUser | null>(this.loadStoredUser());

  // ── Safe storage helpers (no-op on the server) ──────────
  private storageGet(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }
  private storageSet(key: string, value: string): void {
    if (this.isBrowser) localStorage.setItem(key, value);
  }
  private storageRemove(key: string): void {
    if (this.isBrowser) localStorage.removeItem(key);
  }

  private loadStoredUser(): HkUser | null {
    const raw = this.storageGet(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return this.storageGet(TOKEN_KEY);
  }

  private persistSession(token: string, user: HkUser): void {
    this.storageSet(TOKEN_KEY, token);
    this.storageSet(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private persistUser(user: HkUser): void {
    this.storageSet(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  logout(): void {
    this.storageRemove(TOKEN_KEY);
    this.storageRemove(USER_KEY);
    this.currentUser.set(null);
  }

  register(payload: { full_name: string; email: string; phone: string; password: string; gender?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, payload).pipe(
      tap((res) => {
        if (res?.token && res?.user) this.persistSession(res.token, res.user);
      })
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, payload).pipe(
      tap((res) => {
        if (res?.token && res?.user) this.persistSession(res.token, res.user);
      })
    );
  }

  fetchMe(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.base}/auth/me`, { headers: this.authHeader() }).pipe(
      tap((res) => {
        if (res?.user) this.persistUser(res.user);
      })
    );
  }

  updateProfile(payload: { full_name?: string; phone?: string; gender?: string }): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.base}/auth/profile`, payload, { headers: this.authHeader() }).pipe(
      tap((res) => {
        if (res?.user) this.persistUser(res.user);
      })
    );
  }

  uploadProfilePicture(file: File): Observable<ProfilePictureResponse> {
    const formData = new FormData();
    formData.append('profile_pic', file);
    return this.http.post<ProfilePictureResponse>(`${this.base}/auth/profile/picture`, formData, { headers: this.authHeader() }).pipe(
      tap((res) => {
        const current = this.currentUser();
        if (res?.profile_pic && current) {
          this.persistUser({ ...current, profile_pic: res.profile_pic });
        }
      })
    );
  }

  changePassword(payload: { current_password: string; new_password: string }): Observable<AuthResponse> {
    return this.http.put<AuthResponse>(`${this.base}/auth/password`, payload, { headers: this.authHeader() });
  }

  deactivateAccount(password: string): Observable<AuthResponse> {
    return this.http
      .delete<AuthResponse>(`${this.base}/auth/account`, { headers: this.authHeader(), body: { password } })
      .pipe(tap(() => this.logout()));
  }

  /** Public so other services (favourites, bookings) can reuse it */
  authHeader(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}