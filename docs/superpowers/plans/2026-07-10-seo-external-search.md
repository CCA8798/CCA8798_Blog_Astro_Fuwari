# SEO External Search Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve external search engine discoverability and social sharing appearance for CCA8798 blog.

**Architecture:** Modify `Layout.astro` as the central SEO tag injection point, extend `SiteConfig` type for new config fields, add a `BreadcrumbJsonLd.astro` component, wire post frontmatter data through to layout props.

**Tech Stack:** Astro 5, TypeScript, no new npm packages.

---

### Task 1: Extend `SiteConfig` type with SEO fields

**Files:**
- Modify: `src/types/config.ts`

- [ ] **Step 1: Add SEO fields to SiteConfig**

Insert after `favicon: Favicon[];`:

```typescript
	ogImage?: {
		src: string;
	};
	keywords?: string[];
	verification?: {
		google?: string;
		baidu?: string;
	};
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/types/config.ts
git commit -m "feat(config): add SEO fields to SiteConfig type"
```

---

### Task 2: Populate SEO config defaults

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add SEO values to siteConfig**

Append after the `favicon: [...]` block in `src/config.ts`:

```typescript
	ogImage: {
		src: "assets/images/blurred-banner.png",
	},
	keywords: ["blog", "CCA8798", "技术", "个人博客"],
	verification: {
		// google: "YOUR_GOOGLE_VERIFICATION_CODE",
		// baidu: "YOUR_BAIDU_VERIFICATION_CODE",
	},
```

Leave verification codes commented out by default.

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): populate default SEO config values"
```

---

### Task 3: Add canonical URL + OG image + meta keywords + verification to Layout.astro

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: Update Layout props interface**

Change `Props` to accept all needed data:

```typescript
interface Props {
	title?: string;
	banner?: string;
	description?: string;
	lang?: string;
	setOGTypeArticle?: boolean;
	image?: string;               // NEW: for og:image
	tags?: string[];               // NEW: for article:tag + keywords
	published?: Date;              // NEW: for article:published_time
	updated?: Date;                // NEW: for article:modified_time
	author?: string;               // NEW: for article:author
}
```

Update destructuring:

```typescript
let {
	title, banner, description, lang, setOGTypeArticle,
	image, tags, published, updated, author,
} = Astro.props;
```

- [ ] **Step 2: Add canonical link tag after `<title>`**

Insert after line 84 `<title>{pageTitle}</title>`:

```astro
<link rel="canonical" href={Astro.url}>
```

- [ ] **Step 3: Add og:image block after og:type**

Insert after the `og:type` block (after line 98):

```astro
{/* OG image */}
{(image || siteConfig.ogImage?.src) && (
	<>
		<meta property="og:image" content={new URL(image || siteConfig.ogImage!.src, Astro.url)}>
		<meta property="og:image:width" content="1200">
		<meta property="og:image:height" content="630">
		<meta name="twitter:image" content={new URL(image || siteConfig.ogImage!.src, Astro.url)}>
	</>
)}
```

- [ ] **Step 4: Add article OG tags after twitter block**

Insert after `twitter:description` (after line 103):

```astro
{/* Article-specific OG tags */}
{setOGTypeArticle && <>
	{published && <meta property="article:published_time" content={published.toISOString()}>}
	{updated && <meta property="article:modified_time" content={updated.toISOString()}>}
	{tags?.map(tag => <meta property="article:tag" content={tag}>)}
	{author && <meta property="article:author" content={author}>}
</>}
```

- [ ] **Step 5: Add meta keywords + locale**

Insert after `<meta name="author">` (after line 88):

```astro
{tags && tags.length > 0
	? <meta name="keywords" content={tags.join(", ")}>
	: siteConfig.keywords && <meta name="keywords" content={siteConfig.keywords.join(", ")}>
}
<meta property="og:locale" content={siteLang}>
```

- [ ] **Step 6: Add search console verification tags**

Insert before `<slot name="head">` (before line 149):

```astro
{/* Search console verification */}
{siteConfig.verification?.google && (
	<meta name="google-site-verification" content={siteConfig.verification.google}>
)}
{siteConfig.verification?.baidu && (
	<meta name="baidu-site-verification" content={siteConfig.verification.baidu}>
)}
```

- [ ] **Step 7: Verify build passes**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat(seo): add canonical URL, OG image, article tags, keywords, verification"
```

---

### Task 4: Wire post data to Layout in article page

**Files:**
- Modify: `src/pages/posts/[...slug].astro`

- [ ] **Step 1: Pass image, tags, dates, author to MainGridLayout**

On line 62, find `<MainGridLayout ...>` and add the new props:

```astro
<MainGridLayout
	banner={entry.data.image}
	title={entry.data.title}
	description={entry.data.description}
	lang={entry.data.lang}
	setOGTypeArticle={true}
	headings={mergedHeadings}
	image={entry.data.image}
	tags={entry.data.tags}
	published={entry.data.published}
	updated={entry.data.updated}
	author={entry.data.author || profileConfig.name}
>
```

- [ ] **Step 2: Pass image, tags, dates, author through to Layout**

In `src/layouts/MainGridLayout.astro`, update `Props` interface to accept the new fields:

```typescript
interface Props {
	title?: string;
	banner?: string;
	description?: string;
	lang?: string;
	setOGTypeArticle?: boolean;
	headings?: MarkdownHeading[];
	image?: string;
	tags?: string[];
	published?: Date;
	updated?: Date;
	author?: string;
}
```

And pass them down to `<Layout ...>` on line 49:

```astro
<Layout
	title={title} banner={banner} description={description}
	lang={lang} setOGTypeArticle={setOGTypeArticle}
	image={image} tags={tags}
	published={published} updated={updated} author={author}
>
```

- [ ] **Step 3: Verify build passes**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/posts/[...slug].astro src/layouts/MainGridLayout.astro
git commit -m "feat(seo): wire post image, tags, dates, author through to Layout"
```

---

### Task 5: Create BreadcrumbList JSON-LD component

**Files:**
- Create: `src/components/widget/BreadcrumbJsonLd.astro`

- [ ] **Step 1: Write the BreadcrumbJsonLd component**

Create `src/components/widget/BreadcrumbJsonLd.astro`:

```astro
---
import { url } from "@utils/url-utils";
import { siteConfig } from "@/config";
import { pathsEqual } from "@utils/url-utils";

interface BreadcrumbItem {
	name: string;
	path: string;
}

interface Props {
	items?: BreadcrumbItem[];
}

const { items = [] } = Astro.props;
const currentPath = Astro.url.pathname;

// Always start with Home
const breadcrumbs: BreadcrumbItem[] = [
	{ name: siteConfig.title, path: url("/") },
];

// If custom items provided, append them (filter out duplicates of home)
if (items.length > 0) {
	for (const item of items) {
		if (!pathsEqual(item.path, url("/"))) {
			breadcrumbs.push(item);
		}
	}
}

// Ensure the last item is the current page (use leaf name if not already present)
const lastCustom = items[items.length - 1];
if (!lastCustom || !pathsEqual(lastCustom.path, currentPath)) {
	// Extract page name from URL
	const segments = currentPath.replace(/\/$/, "").split("/").filter(Boolean);
	const leafName = segments[segments.length - 1] || "";
	if (leafName) {
		breadcrumbs.push({ name: decodeURIComponent(leafName), path: currentPath });
	}
}

const jsonLd = {
	"@context": "https://schema.org",
	"@type": "BreadcrumbList",
	itemListElement: breadcrumbs.map((item, index) => ({
		"@type": "ListItem",
		position: index + 1,
		name: item.name,
		item: new URL(item.path, Astro.url).href,
	})),
};
---

<script is:inline type="application/ld+json" set:html={JSON.stringify(jsonLd)}></script>
```

- [ ] **Step 2: Wire into MainGridLayout**

In `src/layouts/MainGridLayout.astro`, import and render the component near the top of the template:

```astro
---
// Add to imports:
import BreadcrumbJsonLd from "@components/widget/BreadcrumbJsonLd.astro";
---
```

Insert right before `<Layout ...>` (or inside, near the top of the body):

```astro
<BreadcrumbJsonLd />
```

- [ ] **Step 3: Add article-specific breadcrumbs**

In `src/pages/posts/[...slug].astro`, pass breadcrumb items:

```astro
---
// Pass items via slot or as prop
// Actually, since BreadcrumbJsonLd is in MainGridLayout, we can pass via slot
---

<MainGridLayout ...>
	<BreadcrumbJsonLd slot="head" items={[
		{ name: "归档", path: url("/archive") },
		{ name: entry.data.category || "文章", path: url("/") },
		{ name: entry.data.title, path: Astro.url.pathname },
	]} />
```

Wait — this would create a second BreadcrumbJsonLd instance. Let me rethink.

Better approach: Add optional `breadcrumbItems` prop to `MainGridLayout` and pass it through to `BreadcrumbJsonLd`.

In `MainGridLayout.astro`:

```typescript
interface Props {
	// ... existing props
	breadcrumbItems?: { name: string; path: string }[];
}
```

Render conditionally:

```astro
<BreadcrumbJsonLd items={breadcrumbItems} />
```

In `[...slug].astro`:

```astro
<MainGridLayout
	...
	breadcrumbItems={[
		{ name: "归档", path: url("/archive") },
		{ name: entry.data.category || "文章", path: url(`/category/${entry.data.category}`) },
		{ name: entry.data.title, path: Astro.url.pathname },
	]}
>
```

Hmm, this is getting complex. Let me simplify — just have the BreadcrumbJsonLd auto-generate from URL path in MainGridLayout for now. It can be enhanced later.

- [ ] **Step 4: Simplified approach — auto-detect breadcrumbs from URL**

Update the `BreadcrumbJsonLd.astro` to auto-detect from URL path, removing the `items` prop complexity. The component already does this in its fallback logic.

For now, just render `<BreadcrumbJsonLd />` in `MainGridLayout` and it'll auto-generate breadcrumbs from the URL. Article pages get richer breadcrumbs as a future enhancement.

- [ ] **Step 5: Verify build passes**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/widget/BreadcrumbJsonLd.astro src/layouts/MainGridLayout.astro
git commit -m "feat(seo): add BreadcrumbList JSON-LD component"
```

---

### Task 6: Wire breadcrumbs for article pages

**Files:**
- Modify: `src/layouts/MainGridLayout.astro`
- Modify: `src/pages/posts/[...slug].astro`

- [ ] **Step 1: Add breadcrumbItems prop to MainGridLayout**

In `src/layouts/MainGridLayout.astro`:

```typescript
interface Props {
	// ... existing
	breadcrumbItems?: { name: string; path: string }[];
}
```

Pass to BreadcrumbJsonLd:

```astro
<BreadcrumbJsonLd items={breadcrumbItems} />
```

- [ ] **Step 2: Pass breadcrumbs from article page**

In `[...slug].astro`, add to `<MainGridLayout>`:

```astro
breadcrumbItems={[
	{ name: "归档", path: url("/archive") },
	...(entry.data.category ? [{ name: entry.data.category, path: url(`/category/${entry.data.category}`) }] : []),
	{ name: entry.data.title, path: Astro.url.pathname },
]}
```

- [ ] **Step 3: Verify build passes**

Run: `pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/layouts/MainGridLayout.astro src/pages/posts/[...slug].astro
git commit -m "feat(seo): wire article breadcrumb items to BreadcrumbList"
```

---

### Task 7: Final verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run full lint + typecheck**

```bash
pnpm lint && pnpm check
```

Expected: 0 errors, 0 warnings (pre-existing warnings only)

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: exit 0, `dist/` generated

- [ ] **Step 3: Verify SEO tags in built output**

```bash
Get-Content -Path "dist/posts/260426_*/index.html" -TotalCount 50
```

Check for:
- `<link rel="canonical"` present
- `<meta property="og:image"` present with absolute URL
- `<meta property="article:published_time"` present
- `<meta name="keywords"` present
- `<script type="application/ld+json">` with BreadcrumbList present

- [ ] **Step 4: Push and create PR**

```bash
git push origin feat/seo-external-search
gh pr create --base master --head feat/seo-external-search --title "feat(seo): enhance external search SEO with OG image, canonical, breadcrumb, verification" --body "See design doc: docs/superpowers/specs/2026-07-10-seo-external-search-design.md"
```

Expected: PR created successfully
