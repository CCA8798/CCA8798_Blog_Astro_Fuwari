# SEO External Search Enhancement Design

## Overview

Improve the blog's external search engine discoverability and social sharing appearance through structured data, Open Graph enhancements, canonical URLs, and search console integration.

## Current State

The blog already has:
- Basic `<title>`, `<meta description>`, `<meta author>`
- Open Graph tags: `og:site_name`, `og:url`, `og:title`, `og:description`, `og:type`
- Twitter Card: `summary_large_image`
- RSS Feed, Sitemap (`@astrojs/sitemap`), robots.txt
- JSON-LD `BlogPosting` on article pages only

## Scope (Phase 1 — Core)

### 1. Open Graph / Twitter Image (`og:image`, `twitter:image`)

**Problem:** Social shares have no preview image.

**Solution:**
- Article pages: use `entry.data.image` (post cover) as `og:image`
- Non-article pages: use site banner as fallback `og:image`
- Add `og:image:width`, `og:image:height` (set to `1200`, `630`)
- Add `twitter:image` synced with `og:image`
- Extend `SiteConfig` type with `ogImage` optional field for a default fallback

### 2. Canonical URL (`<link rel="canonical">`)

**Problem:** No explicit canonical URL on any page.

**Solution:**
- Add `<link rel="canonical" href={Astro.url}>` in `Layout.astro`
- Astro's `Astro.url` already resolves to the full canonical URL

### 3. Article Open Graph Enhancement

**Problem:** Article pages lack `article:published_time`, `article:modified_time`, `article:tag`, `article:author`.

**Solution:**
- In `Layout.astro`, conditionally emit `article:*` tags when `setOGTypeArticle` is true
- `article:published_time` — ISO format of `published` date
- `article:modified_time` — ISO format of `updated` date (if available)
- `article:tag` — each tag from `tags[]` array
- `article:author` — author name

### 4. BreadcrumbList JSON-LD

**Problem:** Search result snippets lack breadcrumb rich results.

**Solution:**
- Add `BreadcrumbList` structured data to all pages
- Generate breadcrumbs based on URL path segments
- For article pages: Home > Posts > [Category] > [Article Title]
- For other pages: Home > [Page Name]
- Implement as an Astro component `BreadcrumbJsonLd.astro`

### 5. Meta Keywords (Baidu compatibility)

**Problem:** Chinese search engines consider `<meta name="keywords">`.

**Solution:**
- Article pages: populate from `entry.data.tags` joined by commas
- Other pages: use site-level keywords from config
- Extend `SiteConfig` with optional `keywords` field

### 6. Search Console Verification

**Problem:** No Google / Baidu webmaster verification.

**Solution:**
- Add `google-site-verification` meta tag via config
- Add `baidu-site-verification` meta tag via config
- Extend `SiteConfig` with optional `verification` object:
  ```ts
  verification?: {
    google?: string;
    baidu?: string;
  }
  ```

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/config.ts` | Add `ogImage`, `keywords`, `verification` fields to `SiteConfig` |
| `src/config.ts` | Populate new `SiteConfig` fields with sensible defaults |
| `src/layouts/Layout.astro` | Add canonical link, OG image, article OG tags, meta keywords, verification meta, pass tags/author via props |
| `src/pages/posts/[...slug].astro` | Pass `tags`, `published`, `updated`, `author` + `image` to Layout |
| `src/components/widget/BreadcrumbJsonLd.astro` | **New:** BreadcrumbList structured data component |
| Other page `.astro` files | Pass breadcrumb info where appropriate |

## Out of Scope (Phase 2)

- WebSite / Organization JSON-LD
- Hreflang tags
- Sitemap customization (lastmod, changefreq)
- Performance SEO (preconnect, preload)
- Analytics integration

## Dependencies

- No new npm packages
- `@astrojs/sitemap` already installed — no changes needed
- Pure Astro frontmatter + inline JSON-LD
