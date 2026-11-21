// core/services/seo.service.ts
// One place for everything search engines and link previews read:
// <title>, meta description, canonical URL, robots (index / noindex),
// Open Graph + Twitter cards, and JSON-LD structured data.
//
// Works with SSR: tags are written into the server-rendered HTML,
// which is what Google, WhatsApp, Facebook and LinkedIn read.
//
// Setup (once): in app.config.ts add to providers
//   provideAppInitializer(() => inject(SeoService).init()),
import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Your live domain, e.g. 'https://www.hostelkhojo.com'. Empty = use the current address. */
export const SITE_URL: string = '';
export const SITE_NAME = 'HostelKhojo';
/** 1200×630 picture used when a page has no photo of its own (public/og-image.jpg). */
const DEFAULT_IMAGE = '/og-image.jpg';

export interface SeoData {
  title: string;
  description: string;
  /** Path for the canonical link, e.g. '/properties/6'. Defaults to the current path without ?query. */
  path?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'place';
  /** false = keep this page out of Google (private pages). */
  index?: boolean;
}

interface RouteSeo {
  match: RegExp;
  seo: Omit<SeoData, 'path'>;
}

const DEFAULT_DESCRIPTION =
  'Find verified hostels, PGs and co-living rooms across India with real photos, food and amenity details. Contact owners directly — zero brokerage.';

// Defaults per page. Detail pages (a property, a city) replace these
// with their own data once it has loaded.
const ROUTES: RouteSeo[] = [
  {
    match: /^\/(home)?$/,
    seo: {
      title: 'HostelKhojo — Verified Hostels & PGs Across India | Zero Brokerage',
      description: DEFAULT_DESCRIPTION,
    },
  },
  {
    match: /^\/find-hostel$/,
    seo: {
      title: 'Find Hostels & PGs Near You — Filter by City, Budget & Gender | HostelKhojo',
      description:
        'Search verified hostels and PG accommodation by city, area, budget, boys/girls and room type. Compare rent, food and amenities, then book without a broker.',
    },
  },
  {
    match: /^\/properties$/,
    seo: {
      title: 'All Hostels & PG Rooms for Rent in India | HostelKhojo',
      description:
        'Browse every verified hostel, PG and co-living space on HostelKhojo. Single, double and triple sharing rooms with meals, WiFi and more.',
    },
  },
  {
    match: /^\/properties\/[^/]+$/,
    seo: { title: 'Hostel & PG details | HostelKhojo', description: DEFAULT_DESCRIPTION, type: 'place' },
  },
  {
    match: /^\/cities$/,
    seo: {
      title: 'Hostels & PGs by City — Mumbai, Pune, Bengaluru, Delhi & more | HostelKhojo',
      description: 'Pick a city to see verified hostels and PGs with rent, photos and availability, updated daily.',
    },
  },
  {
    match: /^\/cities\/[^/]+$/,
    seo: { title: 'Hostels & PGs | HostelKhojo', description: DEFAULT_DESCRIPTION },
  },
  {
    match: /^\/services$/,
    seo: {
      title: 'Our Services — Verified Stays, Visits & Move-in Help | HostelKhojo',
      description: 'How HostelKhojo helps students and working professionals find, visit and move into the right hostel or PG.',
    },
  },
  {
    match: /^\/contact$/,
    seo: {
      title: 'Contact HostelKhojo — Call, Email or WhatsApp',
      description: 'Questions about a hostel, PG or listing your property? Reach the HostelKhojo team by phone, email or WhatsApp.',
    },
  },
  {
    match: /^\/register-your-hostel$/,
    seo: {
      title: 'List Your Hostel or PG for Free — Get Tenant Enquiries | HostelKhojo',
      description:
        'Property owners: list up to 5 hostels or PGs free, add photos, rooms, food and rules, and receive enquiries from verified tenants.',
    },
  },
  // Private pages: never in search results
  {
    match: /^\/(login|register|profile|bookings|favorites|settings|owner|super-admin)(\/|$)/,
    seo: { title: 'HostelKhojo', description: DEFAULT_DESCRIPTION, index: false },
  },
];

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);
  private router = inject(Router);
  private started = false;

  /** Call once at app start (see setup note at the top). */
  init(): void {
    if (this.started) return;
    this.started = true;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.applyRouteDefaults(e.urlAfterRedirects));
  }

  /** Full URL for a path on this site. */
  absolute(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return this.origin();
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return this.origin() + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl;
  }

  /** Set everything for the current page. */
  update(data: SeoData): void {
    const title = data.title.length > 70 ? data.title.slice(0, 67).trimEnd() + '…' : data.title;
    const description = this.clip(data.description, 160);
    const url = this.absolute(data.path ?? this.currentPath());
    const image = this.absolute(data.image || DEFAULT_IMAGE);
    const robots = data.index === false ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

    this.title.setTitle(title);
    this.setName('description', description);
    this.setName('robots', robots);
    this.setCanonical(url);

    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:locale', 'en_IN');
    this.setProperty('og:type', data.type === 'place' ? 'place' : data.type || 'website');
    this.setProperty('og:title', title);
    this.setProperty('og:description', description);
    this.setProperty('og:url', url);
    this.setProperty('og:image', image);
    this.setProperty('og:image:alt', title);

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', title);
    this.setName('twitter:description', description);
    this.setName('twitter:image', image);
  }

  /** Add or replace a JSON-LD block. Page blocks are removed on the next navigation. */
  setJsonLd(id: string, data: object | null): void {
    const elId = `ld-${id}`;
    let el = this.doc.getElementById(elId) as HTMLScriptElement | null;
    if (!data) {
      el?.remove();
      return;
    }
    if (!el) {
      el = this.doc.createElement('script');
      el.type = 'application/ld+json';
      el.id = elId;
      el.setAttribute('data-page-ld', '');
      this.doc.head.appendChild(el);
    }
    // "<" escaped so text from the database can't close the script tag
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  /** BreadcrumbList structured data, e.g. [['Home','/'], ['Pune','/cities/pune']]. */
  breadcrumbs(items: Array<[string, string]>): void {
    this.setJsonLd('breadcrumbs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map(([name, path], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        item: this.absolute(path),
      })),
    });
  }

  // ── internals ────────────────────────────────────────────
  private applyRouteDefaults(url: string): void {
    // remove the previous page's structured data
    this.doc.head.querySelectorAll('script[data-page-ld]').forEach((s) => s.remove());

    const path = url.split(/[?#]/)[0] || '/';
    const hit = ROUTES.find((r) => r.match.test(path));
    // /home and / show the same page — tell Google the main address is /
    const canonical = path === '/home' ? '/' : path;
    this.update({ ...(hit?.seo ?? { title: SITE_NAME, description: DEFAULT_DESCRIPTION }), path: canonical });
  }

  private origin(): string {
    if (SITE_URL) return SITE_URL.replace(/\/+$/, '');
    const loc = this.doc.location;
    return loc?.origin && loc.origin !== 'null' ? loc.origin : '';
  }

  private currentPath(): string {
    return (this.router.url || '/').split(/[?#]/)[0] || '/';
  }

  private clip(text: string, max: number): string {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name="${name}"`);
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
