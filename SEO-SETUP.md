# HostelKhojo SEO setup

You need four small edits plus the files in this zip.

---

## 1. `src/index.html`: replace your `<head>` content

Keep any extra `<link>` or `<script>` tags you already have (fonts, icons).
Replace `https://www.hostelkhojo.com` with your real domain in **4 places**.

```html
<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <title>HostelKhojo — Verified Hostels & PGs Across India | Zero Brokerage</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Find verified hostels, PGs and co-living rooms across India with real photos, food and amenity details. Contact owners directly — zero brokerage.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#14152C">
  <meta name="format-detection" content="telephone=no">

  <!-- Paste the code Google Search Console gives you (step 6) -->
  <!-- <meta name="google-site-verification" content="PASTE_CODE_HERE"> -->

  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="apple-touch-icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Defaults for link previews (each page replaces these) -->
  <meta property="og:site_name" content="HostelKhojo">
  <meta property="og:locale" content="en_IN">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://www.hostelkhojo.com/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">

  <!-- Who you are + the sitelinks search box -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.hostelkhojo.com/#org",
        "name": "HostelKhojo",
        "url": "https://www.hostelkhojo.com/",
        "logo": "https://www.hostelkhojo.com/og-image.jpg",
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+91-7021455426",
          "contactType": "customer support",
          "areaServed": "IN",
          "availableLanguage": ["en", "hi", "mr"]
        }
      },
      {
        "@type": "WebSite",
        "name": "HostelKhojo",
        "url": "https://www.hostelkhojo.com/",
        "publisher": { "@id": "https://www.hostelkhojo.com/#org" },
        "inLanguage": "en-IN",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.hostelkhojo.com/find-hostel?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  }
  </script>
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

The phone number is the WhatsApp number from your home page. Change it if needed.

---

## 2. `src/app/app.config.ts`: start the SEO service

Add these two imports at the top:

```ts
import { inject, provideAppInitializer } from '@angular/core';
import { SeoService } from './core/services/seo.service';
```

If `@angular/core` is already imported, just add `inject, provideAppInitializer` to that line.

Then add one line inside `providers: [ ... ]`:

```ts
provideAppInitializer(() => inject(SeoService).init()),
```

**Optional:** if any route in `app.routes.ts` has a `title: '...'`, remove it. The SEO service sets every title now.

---

## 3. `src/server.ts`: serve `/sitemap.xml` and `/robots.txt` from your domain

Find this line:

```ts
const angularApp = new AngularNodeAppEngine();
```

Paste this **directly below it**. It must come before the `express.static(...)` line.

```ts
// ── SEO: sitemap.xml + robots.txt come live from the backend ──
app.set('trust proxy', true); // correct https:// behind Nginx / a load balancer
const SEO_API = process.env['SEO_API_URL'] || 'http://localhost:5000/api'; // same as environment.apiUrl
app.get(['/sitemap.xml', '/robots.txt'], async (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const r = await fetch(`${SEO_API}/home${req.path}?origin=${encodeURIComponent(origin)}`);
    res.status(r.status)
      .set('Cache-Control', 'public, max-age=1800')
      .type(r.headers.get('content-type') || 'text/plain')
      .send(await r.text());
  } catch {
    res.status(503).type('text/plain').send('Temporarily unavailable');
  }
});
```

If your backend doesn't run on port 5000, change `http://localhost:5000/api` to the same address as `apiUrl` in `src/environment.ts`.

---

## 4. Backend `.env`: add your domain

```
SITE_URL=https://www.hostelkhojo.com
# only if photos are served from a different public address than the API
# API_PUBLIC_URL=https://api.hostelkhojo.com
```

Then restart the backend.

**Test it:**

- `http://localhost:5000/api/home/sitemap.xml` should list every page, city and listing.
- `http://localhost:4200/sitemap.xml` and `/robots.txt` show the same through your site.
  - If these two return 404 under `ng serve`, test them after `npm run build` and `npm run serve:ssr:BelapurHostel`.
  - Production uses `server.ts`, so they'll work there.

---

## 5. Files in this zip

| File | Action |
|---|---|
| `hostelbackend/routes/home.js` | Replace. Adds `/sitemap.xml` and `/robots.txt`; nothing else changed. |
| `src/app/core/services/seo.service.ts` | New |
| `src/app/features/property-detail/property-detail.ts` | Replace. Same as the slider version, plus SEO. |
| `src/app/features/cities-view/city-detail.component.ts` | Replace. Same as before, plus SEO. |
| `public/og-image.jpg` | New: the picture shown when someone shares your link |

---

## 6. After you go live: these matter most for ranking

1. **Google Search Console** (search.google.com/search-console):
   - Add your domain and verify it with the meta tag from step 1.
   - Under **Sitemaps**, submit `https://your-domain/sitemap.xml`.
2. **Bing Webmaster Tools:** import from Search Console (one click). It also feeds DuckDuckGo and Yahoo.
3. **Google Business Profile:** create one for HostelKhojo. It drives local "hostel near me" results.
4. **Check the structured data:** paste a property URL into search.google.com/test/rich-results.
5. **HTTPS and speed:** run pagespeed.web.dev on your home and property pages and fix anything red.
6. **Content beats code:**
   - Write unique descriptions for every listing (not copy-paste) and add real photos.
   - Get real reviews.
   - Add city-area guides, e.g. "PGs near IIT Bombay" or "Hostels near Kharghar station".
7. **Links:** listings on college groups, local directories and news mentions build trust over time.
