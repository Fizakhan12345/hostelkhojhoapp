// shared/header/header.ts
// Shows clearly WHO is signed in: Guest, Tenant, Property owner or Super admin.
// The three logins are separate (hk_token / hk_admin_token / hk_super_token),
// so more than one can be active in the same browser — the menu lists them all.
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { SuperAdminService } from '../../core/services/super-admin.service';

export type HkRole = 'guest' | 'tenant' | 'owner' | 'superadmin';

interface MenuLink {
  label: string;
  link: string;
  icon: string; // SVG path data
}

interface Session {
  role: Exclude<HkRole, 'guest'>;
  label: string;
  name: string;
  email: string;
  photo: string | null;
  home: string;
  links: MenuLink[];
}

const ICON = {
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  plus: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
  card: 'M1 4h22v16H1zM1 10h22',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class Header {
  readonly auth = inject(AuthService);
  private adminAuth = inject(AdminAuthService);
  private superAdmin = inject(SuperAdminService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly icon = ICON;

  isScrolled = false;
  isMenuOpen = false;
  userDropdownOpen = false;

  /** Current URL — decides which role is "in front" when several are signed in. */
  private url = signal(this.router.url);

  /** Every login that is active in this browser. */
  sessions = computed<Session[]>(() => {
    const list: Session[] = [];

    const sa = this.superAdmin.currentAdmin();
    if (sa) {
      list.push({
        role: 'superadmin',
        label: 'Super admin',
        name: sa.name || 'Super admin',
        email: sa.email || '',
        photo: null,
        home: '/super-admin/overview',
        links: [
          { label: 'Overview', link: '/super-admin/overview', icon: ICON.grid },
          { label: 'Listings to approve', link: '/super-admin/listings', icon: ICON.shield },
          { label: 'Owners & enquiries', link: '/super-admin/owners', icon: ICON.building },
          { label: 'Users', link: '/super-admin/users', icon: ICON.users },
          { label: 'Plan payments', link: '/super-admin/plan-payments', icon: ICON.card },
        ],
      });
    }

    const owner = this.adminAuth.currentAdmin();
    if (owner) {
      list.push({
        role: 'owner',
        label: 'Property owner',
        name: owner.name || 'Owner',
        email: owner.email || '',
        photo: null,
        home: '/owner/dashboard',
        links: [
          { label: 'Owner dashboard', link: '/owner/dashboard', icon: ICON.grid },
          { label: 'Add a property', link: '/owner/add-property', icon: ICON.plus },
          { label: 'Enquiries', link: '/owner/enquiries', icon: ICON.inbox },
          { label: 'Plans & billing', link: '/owner/plans', icon: ICON.card },
        ],
      });
    }

    const user = this.auth.currentUser();
    if (user) {
      list.push({
        role: 'tenant',
        label: 'Tenant',
        name: user.full_name || 'Tenant',
        email: user.email || '',
        photo: user.profile_pic || null,
        home: '/profile',
        links: [
          { label: 'My profile', link: '/profile', icon: ICON.user },
          { label: 'My bookings', link: '/bookings', icon: ICON.calendar },
          { label: 'Saved hostels', link: '/favorites', icon: ICON.heart },
          { label: 'Settings', link: '/settings', icon: ICON.gear },
        ],
      });
    }
    return list;
  });

  /** The session shown on the header button. */
  active = computed<Session | null>(() => {
    const all = this.sessions();
    if (!all.length) return null;
    const url = this.url();
    const byUrl = url.startsWith('/super-admin')
      ? all.find((s) => s.role === 'superadmin')
      : url.startsWith('/owner')
      ? all.find((s) => s.role === 'owner')
      : null;
    return byUrl || all[0]; // order above = super admin, owner, tenant
  });

  role = computed<HkRole>(() => this.active()?.role ?? 'guest');
  others = computed(() => this.sessions().filter((s) => s !== this.active()));

  /** Kept for any old template code that used these names. */
  get isLoggedIn(): boolean {
    return !!this.active();
  }
  get userName(): string {
    return this.active()?.name ?? '';
  }
  isSuperAdmin = computed(() => this.role() === 'superadmin');
  isOwner = computed(() => this.role() === 'owner');

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.closeMenu();
        this.closeUserDropdown();
      });
  }

  initial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  // ── Scroll / menus ─────────────────────────────────────────
  @HostListener('window:scroll')
  onScroll(): void {
    if (this.isBrowser) this.isScrolled = window.scrollY > 10;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.userDropdownOpen && !this.host.nativeElement.querySelector('.hk-user-dropdown')?.contains(e.target as Node)) {
      this.userDropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.userDropdownOpen = false;
    this.isMenuOpen = false;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isBrowser) document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    if (this.isBrowser) document.body.style.overflow = '';
  }

  toggleUserDropdown(): void {
    this.userDropdownOpen = !this.userDropdownOpen;
  }

  closeUserDropdown(): void {
    this.userDropdownOpen = false;
  }

  // ── Sign out ───────────────────────────────────────────────
  /** Signs out of one role only; the other logins stay. */
  signOut(role: Session['role']): void {
    if (role === 'superadmin') this.superAdmin.logout();
    if (role === 'owner') this.adminAuth.logout();
    if (role === 'tenant') this.auth.logout();
    this.closeUserDropdown();
    this.closeMenu();

    const target = role === 'superadmin' ? '/super-admin/login' : role === 'owner' ? '/register-your-hostel' : '/';
    const url = this.url();
    const leavingPrivateArea =
      (role === 'superadmin' && url.startsWith('/super-admin')) ||
      (role === 'owner' && url.startsWith('/owner')) ||
      (role === 'tenant' && /^\/(profile|bookings|favorites|settings)/.test(url));
    if (leavingPrivateArea || !this.sessions().length) this.router.navigateByUrl(target);
  }

  /** Old name, kept so nothing else breaks: signs out of the role shown. */
  logout(): void {
    const r = this.active()?.role;
    if (r) this.signOut(r);
  }
}
