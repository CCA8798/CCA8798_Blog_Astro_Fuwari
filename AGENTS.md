# AGENTS.md — CCA8798 Blog (Astro + Fuwari)

## Commands

```bash
pnpm dev              # Start dev server (HTTPS via ssl/ certs, port 4321)
pnpm build            # astro build && pagefind --site dist/client
pnpm check            # astro check (type-check Astro files)
pnpm type-check       # tsc --noEmit --isolatedDeclarations
pnpm lint             # biome check --write ./src
pnpm format           # biome format --write ./src
pnpm new-post <name>  # Scaffold a new blog post
pnpm preview          # Preview production build
node server.cjs       # Production server (Express 5, port 4321)
```

- **Package manager**: pnpm only (`preinstall` hook enforces it)
- **Run order**: `pnpm lint && pnpm check && pnpm build` (lint before typecheck, build last)
- **Build output**: `@astrojs/node` in standalone mode → `dist/client` (static assets) + `dist/server` (SSR entry). `postbuild` deletes `dist/client/api`, so API responses come from `server.cjs` or the Astro SSR server — never expect static JSON files for the API in `dist/`.
- **Local pnpm**: an injected `pnpm` shim may be broken (`MODULE_NOT_FOUND`); the working binary is `F:\Web\Nodejs\node_global\pnpm.cmd` (pnpm 9.14.4, Node 24).

## Architecture

| Layer | Tech | Location |
|-------|------|----------|
| Meta-framework | Astro 6 (`astro@6.4.8`) | `astro.config.mjs` |
| Styling | Tailwind v3 + Stylus (.styl) + plain CSS | `src/styles/` |
| Interactive components | Svelte 5 | `src/components/*.svelte` |
| Static/server components | Astro `.astro` | `src/components/` |
| Adapter | `@astrojs/node` standalone | `astro.config.mjs` |
| Production server | Express 5 + Waline runtime | `server.cjs`, `waline-runtime.cjs` |

- **Homepage** = `src/pages/[...page].astro` (pagination, 8 posts/page — `PAGE_SIZE` in `src/constants/constants.ts`)
- **Blog posts** = `src/content/posts/<slug>/index.md|mdx` (frontmatter-driven, images co-located in the post folder)
- **Site config** = `src/config.ts` (title, nav, profile, license, expressive-code theme)
- **Content schema** = `src/content.config.ts` (posts + spec collections; post frontmatter also carries `prevTitle`/`prevSlug`/`nextTitle`/`nextSlug`)
- **Layout chain**: `Layout.astro` (HTML shell) → `MainGridLayout.astro` (nav, banner, sidebar, footer, TOC, back-to-top)
- **Pages**: home `[...page].astro`, `posts/[...slug].astro`, `about`, `archive`, `admin`, `login`, `register`, `lotteryTimes`, `status-history`, `rss.xml.ts`, `robots.txt.ts`
- **API routes** (`src/pages/api/`, dev/SSR): `status.ts` (`/api/status`, plus `?text=` update and `?history`), `status.json.ts` (`/api/status.json` → lottery list from `list.json`), `me.ts` (current session), `admin.ts` (login/register/user management, ~1.4k lines)

## Styling

- **CSS variables** in `src/styles/variables.styl` use OKLCH color space; `--hue` drives theming
- **Theme persistence**: `localStorage` (light/dark/system) via `setting-utils.ts`
- **Page transitions**: Swup, animation class `transition-swup-*` (defined in `transition.css`)
- **Favicons** in `public/favicon/` — light and dark variants supported
- **Custom fonts**: `YangRenDongZhuShiTi-Semibold` (card titles; also registered via Astro `fontProviders.local()` in `astro.config.mjs`) and `YouSheYuFeiTeJianKangTi-2` (post body) — both declared with `@font-face` in `src/styles/main.css`

## Key Patterns

- **ImageWrapper** (`src/components/misc/ImageWrapper.astro`): handles both local (`import.meta.glob`) and remote images
- **Post prev/next navigation**: via frontmatter fields (`prevTitle`, `prevSlug`, `nextTitle`, `nextSlug`) — not auto-generated
- **Pagefind indexes `<article>` elements** post-build — keep semantic structure; `pagefind.yml` excludes KaTeX spans, `[data-pagefind-ignore]` and the search panel
- **Path aliases**: `@components/`, `@assets/`, `@constants/`, `@utils/`, `@i18n/`, `@layouts/`, `@/*` (all map to `src/`)
- **Custom rehype/remark plugins** live in `src/plugins/` (admonitions, GitHub cards, TOC headings, excerpt, reading time, expressive-code add-ons)
- **Waline comments**: one shared runtime (`waline-runtime.cjs`) serves dev (Vite middleware mounted at `/waline`) and production (`server.cjs`), backed by SQLite at `data/waline/waline.sqlite`; frontend is `WalineComment.svelte`
- **API parity**: every `/api/*` endpoint exists twice — Astro route (`src/pages/api/*.ts`) for dev/SSR and an Express handler in `server.cjs` for production. Change both, or say which one you changed.
- **Opening card links in new tab**: add `target="_blank"` with `rel="noopener noreferrer"` to anchor elements

## Runtime Data & Auth

- **Gitignored local state** (never commit): `status.json` (status bar current entry + history, capped at 200), `users.json`, `admin-config.json`, `admin-session.json`, `rate-limit.json`, `register-rate.json`, `data/`, `logs/`, `ssl/`
- **`list.json` is tracked** — it is the data source behind `/api/status.json` for the lottery page
- **User groups**: `admin` > `editor` > `viewer`; passwords stored as scrypt `salt:key`; login limited to 3 attempts / 30 min, session TTL 24 h; registration limited to 3 per hour per IP with a 3 s minimum form time
- **Tokens/secrets**: `STATUS_TOKEN` guards `/api/status?text=` updates (unset = no check; dev falls back to `mtf`); `ADMIN_PASSWORD` (comma-separated) and `WALINE_SUPER_ADMIN_PASSWORD` are injected via env — the latter is read from `data/waline/.super-admin-password` by `start.ps1`

## Deployment

- `start.ps1` — **local only, gitignored**: starts `server.cjs`, then polls `git ls-remote origin master`; on a new commit it stashes local edits, pulls, optionally runs `pnpm install`, rebuilds, and restarts. It backs up `dist/` to `dist-backup/` and rolls back when the build fails. Logs go to `logs/{server,deploy,build}.log`.
- `ecosystem.config.cjs` — **local only, gitignored** (it holds the status token): PM2 app `blog` launching `cmd /c powershell -NoProfile -ExecutionPolicy Bypass -File start.ps1`.
- Production listens on port `4321`; dev HTTPS uses `ssl/key.key` + `ssl/crt.crt` (also gitignored).

## CI

- `.github/workflows/build.yml` and `biome.yml` trigger on `main`, but the repository default branch is `master` — **they currently never run**. Keep this in mind when touching CI or claiming CI coverage.
- `opencode.yml` responds to issue/PR comments containing `/oc` or `/opencode`.

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
