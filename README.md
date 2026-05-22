# 🍥 CCA8798 Blog

![Node.js >= 20](https://img.shields.io/badge/node.js-%3E%3D20-brightgreen)
![pnpm >= 9](https://img.shields.io/badge/pnpm-%3E%3D9-blue)
![Astro 5](https://img.shields.io/badge/Astro-5-FF5D01?logo=astro)

CCA8798 的个人博客，基于 [Astro](https://astro.build) + [Fuwari](https://github.com/saicaca/fuwari) 构建。

**站点：** <https://www.cca8798.com>

## ✨ Features

- **背景粒子动效** — Canvas 粒子系统，首页专用，Swup 页面切换时自动启停
- **实时状态栏** — 显示北京时间、顺德天气（Open-Meteo）、站长状态、每日谏言（一言 API）
- **卡片悬停发光** — 基于 OKLCH 色值的 box-shadow 发光效果
- **Banner 渐变遮罩** — 使用 CSS mask-image 消除亚像素白线
- **明暗主题切换** — 支持 Light / Dark / System 三模式，localStorage 持久化
- **可定制主题色相** — 通过滑块自由调节 `--hue`，支持固定锁定
- **平滑页面过渡** — Swup 驱动的无刷新导航
- **全文搜索** — Pagefind 构建时索引，客户端即时搜索
- **RSS 订阅** — 自动生成 RSS Feed
- **响应式布局** — 桌面端双栏（侧边栏 + 文章列表），移动端单栏
- **Table of Contents** — 文章目录，2xl 断点右侧固定定位
- **Expressive Code** — 增强代码块（行号、折叠、语言标签、复制按钮）
- **扩展 Markdown** — Admonitions, GitHub 仓库卡片, LaTeX 数学公式

## 🏗 Tech Stack

| Layer | Tech |
|-------|------|
| Meta-framework | [Astro 5](https://astro.build) |
| Styling | Tailwind v3 + Stylus (.styl) + plain CSS |
| Interactive components | [Svelte 5](https://svelte.dev) |
| Page transitions | [Swup](https://swup.js.org) |
| Search | [Pagefind](https://pagefind.app) |
| Icons | [Iconify](https://iconify.design) |
| Code blocks | [Expressive Code](https://expressive-code.com) |
| Production server | Express 5 (`server.cjs`) |

## 🚀 Quick Start

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (HTTPS)
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器 (Express, 提供 API)
node server.cjs
```

### 配置 SSL 证书

开发服务器使用 HTTPS，需要将 SSL 证书放在 `ssl/` 目录：

```
ssl/
├── key.key
└── crt.crt
```

## ⚡ Commands

| Command | Action |
|---------|--------|
| `pnpm dev` | 启动开发服务器（HTTPS） |
| `pnpm build` | `astro build && pagefind --site dist` |
| `pnpm preview` | 预览生产构建 |
| `pnpm check` | Astro 类型检查 |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` |
| `pnpm lint` | `biome check --write ./src` |
| `pnpm format` | `biome format --write ./src` |
| `pnpm new-post <name>` | 创建新博客文章 |

**推荐运行顺序：** `pnpm lint && pnpm check && pnpm build`

## 📁 Project Structure

```
src/
├── components/          # Svelte & Astro 组件
│   ├── BackgroundParticles.astro   # 粒子背景
│   ├── StatusBar.svelte            # 状态栏
│   ├── PostCard.astro              # 文章卡片
│   ├── Search.svelte               # 全文搜索
│   ├── LightDarkSwitch.svelte      # 主题切换
│   └── ...
├── content/
│   └── posts/          # MDX 文章
├── layouts/
│   ├── Layout.astro               # HTML 外壳
│   └── MainGridLayout.astro       # 主布局（导航/横幅/状态栏/网格）
├── pages/
│   ├── [...page].astro            # 首页（分页）
│   ├── api/
│   │   ├── status.ts              # GET /api/status (Astro dev)
│   │   └── status/update.ts       # GET /api/status/update (Astro dev)
│   └── ...
├── styles/
│   ├── main.css                   # 全局组件样式
│   ├── variables.styl             # CSS 变量（OKLCH）
│   └── transition.css             # Swup 过渡动画
├── config.ts                      # 站点配置
└── plugins/                       # 自定义 rehype/remark 插件
```

## 📡 Status Bar & API

状态栏位于首页主内容区顶部，显示四项信息：

```
● 北京时间 14:30:25  ● 顺德天气：28°C 晴  ● 站长状态：写博客  ● 每日谏言：XXX
```

### API 端点

生产环境（`node server.cjs`）提供以下 API：

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | 获取当前状态 |
| GET | `/api/status/update?text=xxx&token=yyy` | 更新状态 |

开发环境（`pnpm dev`）由 Astro API Routes 提供相同功能。

### 数据源

| 项目 | API | 认证 |
|------|-----|------|
| 北京时间 | 浏览器 Date (Asia/Shanghai) | — |
| 顺德天气 | [Open-Meteo](https://open-meteo.com) | 免费，无需 Key |
| 站长状态 | 本地 `status.json` | 更新需 Token |
| 每日谏言 | [一言](https://hitokoto.cn) | 免费，无需 Key |

## 🔧 How to Update Your Status

部署后，通过访问以下 URL 即可更新状态：

```
https://你的域名/api/status/update?text=你想说的话&token=你的密钥
```

### 设置 Token

1. **方式一：环境变量**（推荐生产环境）

   在服务器上启动 `server.cjs` 时设置环境变量：

   ```bash
   STATUS_TOKEN=your_secret_token node server.cjs
   ```

2. **方式二：不设 Token**（仅限本地开发）

   如果不设置 `STATUS_TOKEN`，API 不校验 Token，任何人可修改。

### 示例

```bash
# 设置状态
curl "https://www.cca8798.com/api/status/update?text=今天在写博客&token=mysecret"

# 清除状态
curl "https://www.cca8798.com/api/status/update?text=&token=mysecret"

# 查看当前状态
curl "https://www.cca8798.com/api/status"
```

> **提示：** 可以把更新 URL 存为浏览器书签，访问即更新，非常方便。

## 🚢 Deployment

1. 构建静态文件：

   ```bash
   pnpm build
   ```

2. 将 `dist/` 目录和 `server.cjs` 部署到服务器

3. 启动 Express 生产服务器：

   ```bash
   STATUS_TOKEN=your_secret_token node server.cjs
   ```

服务器默认监听 `4321` 端口。建议使用 PM2 或 systemd 管理进程。

## 🧩 Configuration

主要配置文件：

| File | Purpose |
|------|---------|
| `src/config.ts` | 站点标题、导航、个人资料、许可证、代码主题 |
| `astro.config.mjs` | Astro 构建配置、集成、SSL |
| `src/constants/constants.ts` | 布局常量（Banner 高度、分页大小等） |

## 🤝 Git Workflow

### Branch Naming

- `feat/<description>` — 新功能
- `fix/<description>` — 缺陷修复
- `refactor/<description>` — 重构
- `deps/<package>` — 依赖更新 (Dependabot 自动管理)

### Commit Message

```
<type>(<scope>): <imperative subject>
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `deps`

### Pre-Push Checklist

```bash
pnpm lint
pnpm check
git status   # 确认只暂存了目标文件
```

## 📄 License

- **源代码**（`src/`、`server.cjs`、`astro.config.mjs` 等）：基于 [Fuwari](https://github.com/saicaca/fuwari) 模板构建，遵循 **MIT License**。
- **文章内容**（`src/content/posts/`）：遵循 **CC BY-NC-SA 4.0**（署名—非商业性使用—相同方式共享）。
- **头像与品牌标识**：保留所有权利。
