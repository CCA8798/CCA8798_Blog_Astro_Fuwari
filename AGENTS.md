# AGENTS.md — CCA8798 Blog (Astro + Fuwari)

## Commands

```bash
pnpm dev              # Start dev server (HTTPS via ssl/ certs)
pnpm build            # astro build && pagefind --site dist
pnpm check            # astro check (type-check Astro files)
pnpm type-check       # tsc --noEmit --isolatedDeclarations
pnpm lint             # biome check --write ./src
pnpm format           # biome format --write ./src
pnpm new-post <name>  # Scaffold a new blog post
pnpm preview          # Preview production build
```

- **Package manager**: pnpm only (`preinstall` hook enforces it)
- **Run order**: `pnpm lint && pnpm check && pnpm build` (lint antes typecheck, build last)

## Architecture

| Layer | Tech | Location |
|-------|------|----------|
| Meta-framework | Astro 5 | `astro.config.mjs` |
| Styling | Tailwind v3 + Stylus (.styl) + plain CSS | `src/styles/` |
| Interactive components | Svelte 5 | `src/components/*.svelte` |
| Static/server components | Astro `.astro` | `src/components/` |

- **Homepage** = `src/pages/[...page].astro` (pagination, 8 posts/page)
- **Blog posts** = `src/content/posts/*/index.md` (MDX, frontmatter-driven)
- **Site config** = `src/config.ts` (title, nav, profile, license, expressive-code theme)
- **Content schema** = `src/content/config.ts` (posts + spec collections)
- **Layout chain**: `Layout.astro` (HTML shell) → `MainGridLayout.astro` (nav, banner, sidebar, footer, TOC, back-to-top)

## Styling

- **CSS variables** in `src/styles/variables.styl` use OKLCH color space; `--hue` drives theming
- **Theme persistence**: `localStorage` (light/dark/system) via `setting-utils.ts`
- **Page transitions**: Swup, animation class `transition-swup-*` (defined in `transition.css`)
- **Favicons** in `public/favicon/` — light and dark variants supported
- **Custom fonts**: `YangRenDongZhuShiTi-Semibold` (card titles), `YouSheYuFeiTeJianKangTi-2` (post body)

## Key Patterns

- **ImageWrapper** (`src/components/misc/ImageWrapper.astro`): handles both local (`import.meta.glob`) and remote images
- **Post prev/next navigation**: via frontmatter fields (`prevTitle`, `prevSlug`, `nextTitle`, `nextSlug`) — not auto-generated
- **Pagefind indexes `<article>` elements** post-build — keep semantic structure
- **Path aliases**: `@components/`, `@assets/`, `@constants/`, `@utils/`, `@i18n/`, `@layouts/`, `@/*` (all map to `src/`)
- **Custom rehype/remark plugins** live in `src/plugins/`
- **server.cjs** provides Express static serving + `/api/status.json` for lottery page
- **Opening card links in new tab**: add `target="_blank"` with `rel="noopener noreferrer"` to anchor elements

## Git Workflow

### Branch Naming
- Feature: `feat/<short-description>` (e.g. `feat/status-bar`, `feat/dark-mode`)
- Bugfix: `fix/<short-description>` (e.g. `fix/card-glow-clip`)
- Refactor: `refactor/<short-description>`
- Dependencies: `deps/<package-name>` (auto-managed by Dependabot)
- Use kebab-case only, keep under 40 chars

### Commit Message Format
```
<type>(<scope>): <imperative subject>
```

- **Types**: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `deps`
- **Scope**: component or file (optional), e.g. `StatusBar`, `server`, `main.css`
- **Subject**: imperative present tense, no period, <72 chars
- Multi-line body allowed for complex changes (blank line after subject)

Examples:
```
feat(StatusBar): add live clock, weather, status, and daily proverb
fix(main.css): remove overflow-hidden to allow card glow to bleed out
feat(server): add GET /api/status and GET /api/status/update endpoints
```

### Pull Request
- Title follows commit message format
- Body includes:
  - What was changed
  - Why (motivation)
  - Checklist of key files modified
- Base branch: `master`
- After merge, delete the feature branch

### Pre-Push Checklist
1. `pnpm lint` — no new errors
2. `pnpm check` — no new errors
3. Only intended files staged (`git status` to verify)

### Network Proxy

当 GitHub 网络不通时，本地有 HTTP 代理（端口 **7897**，HTTP/S 通用）：

```bash
git config http.proxy http://127.0.0.1:7897
git config https.proxy http://127.0.0.1:7897
# gh CLI 需要通过环境变量
$env:HTTP_PROXY="http://127.0.0.1:7897"; $env:HTTPS_PROXY="http://127.0.0.1:7897"
```

操作完成后建议清除代理配置：

```bash
git config --unset http.proxy
git config --unset https.proxy
```

## 交互要求

- Thinking思考过程用中文表述
- Reply回答也要用中文回复
