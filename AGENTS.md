# AGENTS.md — CCA8798 Blog (Fuwari)

## 交互要求

1. **思考过程全程使用中文** — 包括需求分析、逻辑拆解、方案选择、步骤推导等所有内部推理环节。
2. **输出内容全部使用中文** — 包括文字解释、代码注释、步骤说明等，仅代码语法本身的英文关键词除外。

## Quick start

```bash
pnpm install        # dependencies (only-allow pnpm enforced)
pnpm dev            # HTTPS dev server at localhost:4321 (needs ssl/ certs)
pnpm build          # astro build + pagefind --site dist (search indexing)
pnpm preview        # preview production build locally
```

Package manager is **pnpm >= 9**, Node >= 20. Lockfile: `pnpm-lock.yaml`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts Astro dev server. Uses HTTPS with local certs in `ssl/`. Allowed hosts configured for `home.cca8798.com`, `www.cca8798.com`. |
| `pnpm build` | `astro build && pagefind --site dist`. Builds static site then indexes search. |
| `pnpm check` | `astro check` — type-check for `.astro` files (does NOT run `tsc`). |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` — stricter TS check. |
| `pnpm format` | `biome format --write ./src` |
| `pnpm lint` | `biome check --write ./src` |
| `pnpm new-post <filename>` | Creates a new post in `src/content/posts/` with frontmatter stub. |
| `pnpm astro ...` | Astro CLI passthrough (e.g. `pnpm astro add`, `pnpm astro check`). |

**CI runs**: `biome ci ./src` (lint), `pnpm astro check` (check), `pnpm astro build` (build **without** Pagefind, using `astro build` directly, not the `pnpm build` script).

## Verification ordering

```bash
pnpm check       # 1. Astro type-checks
pnpm type-check  # 2. TypeScript type-checks (strict null checks, isolated declarations)
pnpm lint        # 3. Biome lint
pnpm format      # 4. Biome format
pnpm build       # 5. Production build + search indexing
```

## Project structure

- `src/config.ts` — site configuration (title, nav, profile, theme, banner, etc.)
- `src/content/config.ts` — Zod schemas for posts and spec content collections
- `src/content/posts/` — blog posts (Markdown/MDX)
- `src/content/archived/` — archived/guide posts
- `src/types/config.ts` — TypeScript type definitions for all config
- `src/plugins/` — custom remark/rehype/expressive-code plugins
- `src/layouts/` — `Layout.astro` and `MainGridLayout.astro`
- `src/components/` — Astro + Svelte 5 components (Search, LightDarkSwitch, ArchivePanel are Svelte)
- `src/styles/` — CSS, Stylus variables, expressive-code overrides, transition styles
- `src/i18n/` — internationalization keys, language definitions, translations
- `src/utils/` — content, date, setting, URL utilities
- `src/pages/` — Astro pages (`[...page].astro`, `about.astro`, `archive.astro`, `lotteryTimes.astro`, RSS, robots.txt)
- `server.cjs` — Express server for production (serves `dist/` and `/api/status.json` from `list.json`)

## Conventions

- **Format/Lint**: Biome (indent: tabs, quotes: double). Style and CSS files are excluded from Biome.
- **Dark mode**: Class-based (`darkMode: "class"`), manually toggled.
- **Page transitions**: Swup with custom animation class `transition-swup-` (not default `transition-`).
- **Path aliases** (in tsconfig.json & Astro): `@/` → `src/`, `@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*`.
- **Commits**: Conventional Commits format recommended (CONTRIBUTING.md).
- **Icons**: Use `astro-icon` with Iconify sets. Find icon codes at https://icones.js.org/.
- **Search**: Pagefind. Excluded selectors in `pagefind.yml`. Only indexed on full `pnpm build`.
- **Expressive Code**: Dark theme only (`github-dark`), configured in `src/config.ts`. Plugins for collapsible sections, line numbers, language badges, custom copy button.
- **Local font**: `YangRenDongZhuShiTi-Semibold` loaded via Astro font provider. See custom `fontFamily` keys in `tailwind.config.cjs`.

## Deployment

- **Target**: `https://www.cca8798.com/` (configured in `astro.config.mjs` `site`)
- **Platform**: Vercel (empty `vercel.json` — relies on framework preset)
- **Custom Express server** at `server.cjs` for production static serving + API.
- Build artifacts in `dist/`. Generated types in `.astro/` (gitignored).
