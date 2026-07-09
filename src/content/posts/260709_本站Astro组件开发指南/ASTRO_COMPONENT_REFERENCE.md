---
title: 本站Astro组件开发指南
published: 2026-07-9T20:10:00+08:00
description: "Astro组件&自定义组件使用指南"
tags: ["Web"]
category: 技术
draft: false
archived: false
author: CCA8798
---

> 本文档记录本项目所有自定义 Astro 组件的接口、Props 与使用方式，以及 Astro 内置常用组件（`Image`、`Content` 等）在本项目中的用法。

---

## 目录

1. [Astro 内置组件](#1-astro-内置组件)
2. [布局组件](#2-布局组件)
3. [页面组件](#3-页面组件)
4. [文章/卡片组件](#4-文章卡片组件)
5. [控件组件](#5-控件组件)
6. [侧边栏小部件](#6-侧边栏小部件)
7. [杂项组件](#7-杂项组件)
8. [特效组件](#8-特效组件)
9. [Svelte 交互组件](#9-svelte-交互组件)
10. [组件组合模式](#10-组件组合模式)

---

## 1. Astro 内置组件

### `<Image>` — `astro:assets`

原生 Astro 内置图像优化组件。**本项目通过 `ImageWrapper` 封装使用**，不直接使用。

```astro
---
import { Image } from "astro:assets";
---

<Image src={img} alt="描述文字" class="w-full h-full object-cover" style="object-position: center" />
```

| Prop | 类型 | 说明 |
|------|------|------|
| `src` | `ImageMetadata` | 由 `import.meta.glob` 导入的图像资源 |
| `alt` | `string` | 替代文本 |
| `class` | `string` | CSS class |
| `style` | `string` | 行内样式 |

> **注意**：`Image` 只接受本地静态导入的图片，不接受远程 URL 或 `/public` 路径。

### `<Content />` — `astro:content`

渲染 MDX/MD 文章的 body 内容。在文章页面中使用：

```astro
---
import { render } from "astro:content";
const { Content, headings, remarkPluginFrontmatter } = await render(entry);
---

<Content />
```

### `<slot />`

Astro 的插槽机制，用于将子内容注入到父组件中。

```astro
<!-- 父组件中定义插槽位置 -->
<slot />
<slot name="head" />   <!-- 命名插槽 -->
```

```astro
<!-- 使用时注入内容 -->
<Layout>
    <p>这是默认插槽的内容</p>
</Layout>

<Layout>
    <div slot="head">这是名为 head 的插槽</div>
</Layout>
```

### `<Fragment>` / `<>`

Astro 内置片段组件，避免额外的 DOM 包裹：

```astro
<Fragment>
    <div>A</div>
    <div>B</div>
</Fragment>

<!-- 或简写 -->
<>
    <div>A</div>
    <div>B</div>
</>
```

---

## 2. 布局组件

### `Layout.astro`

**路径：** `src/layouts/Layout.astro`

HTML 外壳层。设置 `<html>`, `<head>`, `<body>`，加载全局字体、CSS 变量（OKLCH）、主题初始化脚本、OverlayScrollbars、PhotoSwipe 图片灯箱、Swup 页面过渡钩子、粒子背景。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `string` | `siteConfig.title` | 页面标题 |
| `banner` | `string` | `siteConfig.banner.src` | OG 图片 |
| `description` | `string` | `pageTitle` | SEO 描述 |
| `lang` | `string` | `siteConfig.lang` | HTML lang 属性 |
| `setOGTypeArticle` | `boolean` | `false` | OG type 设为 article |

**用法：**

```astro
---
import Layout from "@layouts/Layout.astro";
---

<Layout title="页面标题">
    <slot name="head"></slot>
    <div>页面主体内容</div>
</Layout>
```

**内部自动加载：**

- `<BackgroundParticles />` — Canvas 粒子背景
- `<ConfigCarrier />` — 将 hue 值注入 DOM
- OverlayScrollbars — 自定义滚动条
- PhotoSwipe — 图片点击放大
- Swup 导航钩子 — 页面过渡动画、TOC 显示控制、导航栏显隐

---

### `MainGridLayout.astro`

**路径：** `src/layouts/MainGridLayout.astro`

主内容区布局。包含导航栏、Banner、波浪 SVG、状态栏、侧边栏、主内容区、TOC、回到顶部按钮。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `string` | — | 传递到 Layout |
| `banner` | `string` | — | 传递到 Layout |
| `description` | `string` | — | SEO 描述 |
| `lang` | `string` | — | HTML lang |
| `setOGTypeArticle` | `boolean` | — | OG type |
| `headings` | `MarkdownHeading[]` | `[]` | 文章标题层级，传递给 TOC |

**用法：**

```astro
---
import MainGridLayout from "@layouts/MainGridLayout.astro";
---

<MainGridLayout title="页面标题" headings={headings}>
    <div>主要内容</div>
</MainGridLayout>
```

**网格布局 (Tailwind)：**

```
grid-cols-[17.5rem_auto]
```

- 左侧（17.5rem）：SideBar（头像、分类、标签）
- 右侧（auto）：main 内容区
- 移动端切换为单栏

**内部自动包含：**

- `<Navbar />` — 导航栏
- `<StatusBar />` — 实时状态栏（Svelte）
- `<SideBar />` — 侧边栏（头像、分类、标签）
- `<TOC />` — 文章目录
- `<Footer />` — 页脚
- `<BackToTop />` — 回到顶部

---

## 3. 页面组件

### `[...page].astro`

**路径：** `src/pages/[...page].astro`

首页路由。支持分页（每页 8 篇文章）。Astro `paginate()` 生成 `/`, `/2/`, `/3/` 等页面。

```astro
---
// 内部使用
import MainGridLayout from "@layouts/MainGridLayout.astro";
import PostPage from "@components/PostPage.astro";
import Pagination from "@components/control/Pagination.astro";
---
<MainGridLayout>
    <PostPage page={page} />
    <Pagination page={page} />
</MainGridLayout>
```

### `[...slug].astro`

**路径：** `src/pages/posts/[...slug].astro`

文章详情页。通过 `getStaticPaths()` 遍历所有文章生成静态页面。

```astro
---
const { entry } = Astro.props;
const { Content, headings, remarkPluginFrontmatter } = await render(entry);
---
<MainGridLayout title={entry.data.title} headings={mergedHeadings}>
    <PostMetadata published={...} updated={...} tags={...} category={...} />
    <!-- 文章封面 -->
    <ImageWrapper src={entry.data.image} basePath={postImageBase} />
    <!-- 文章内容 -->
    <Markdown class="mb-6">
        <Content />
    </Markdown>
    <!-- 许可信息 -->
    <License title={entry.data.title} slug={entry.id} pubDate={entry.data.published} />
    <!-- 上下篇导航 -->
</MainGridLayout>
```

---

## 4. 文章/卡片组件

### `PostCard.astro`

**路径：** `src/components/PostCard.astro`

文章卡片组件，用于首页分页列表。带封面图、标题、元数据、字数/阅读时长。

| Prop | 类型 | 说明 |
|------|------|------|
| `entry` | `CollectionEntry<"posts">` | 文章集合条目 |
| `title` | `string` | 文章标题 |
| `url` | `string` | 文章链接 |
| `published` | `Date` | 发布日期 |
| `updated` | `Date` (可选) | 更新日期 |
| `tags` | `string[]` | 标签列表 |
| `category` | `string \| null` | 分类 |
| `image` | `string` | 封面图路径 |
| `description` | `string` | 文章描述 |
| `draft` | `boolean` | 是否为草稿 |
| `class` | `string` (可选) | CSS class |
| `style` | `string` (可选) | 行内样式 |

**用法：**

```astro
<PostCard
    entry={entry}
    title={entry.data.title}
    tags={entry.data.tags}
    category={entry.data.category}
    published={entry.data.published}
    url={getPostUrlBySlug(entry.id)}
    image={entry.data.image}
    description={entry.data.description}
    draft={entry.data.draft}
    class="onload-animation"
    style="animation-delay: 50ms;"
/>
```

---

### `PostPage.astro`

**路径：** `src/components/PostPage.astro`

文章列表容器。遍历分页数据，为每篇文章渲染 `PostCard`。

| Prop | 类型 | 说明 |
|------|------|------|
| `page` | `Page` | Astro 分页对象，包含 `page.data` 文章数组 |

**用法：**

```astro
<PostPage page={page} />
```

---

### `PostMeta.astro`

**路径：** `src/components/PostMeta.astro`

文章元数据行：发布日期、更新日期、分类、标签。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `published` | `Date` | — | 发布日期 |
| `updated` | `Date` (可选) | — | 更新日期 |
| `tags` | `string[]` | — | 标签列表 |
| `category` | `string \| null` | — | 分类 |
| `hideTagsForMobile` | `boolean` | `false` | 移动端隐藏标签 |
| `hideUpdateDate` | `boolean` | `false` | 隐藏更新日期 |
| `class` | `string` (可选) | — | CSS class |

**用法：**

```astro
<PostMetadata
    published={entry.data.published}
    updated={entry.data.updated}
    tags={entry.data.tags}
    category={entry.data.category}
    hideTagsForMobile={true}
    class="mb-4"
/>
```

---

## 5. 控件组件

### `Pagination.astro`

**路径：** `src/components/control/Pagination.astro`

分页导航控件。显示上一页、页码、省略号、下一页。

| Prop | 类型 | 说明 |
|------|------|------|
| `page` | `Page` | Astro 分页对象 |
| `class` | `string` (可选) | CSS class |
| `style` | `string` (可选) | 行内样式 |

**用法：**

```astro
<Pagination class="mx-auto onload-animation" page={page} style="animation-delay: 100ms;" />
```

---

### `ButtonLink.astro`

**路径：** `src/components/control/ButtonLink.astro`

侧边栏链接按钮，带可选角标。

| Prop | 类型 | 说明 |
|------|------|------|
| `badge` | `string` (可选) | 右侧角标文字（如文章数量） |
| `url` | `string` (可选) | 链接地址 |
| `label` | `string` (可选) | aria-label |

默认内容通过 `<slot>` 传入。

**用法：**

```astro
<ButtonLink
    url={c.url}
    badge={String(c.count)}
    label="查看此分类的所有文章"
>
    分类名称
</ButtonLink>
```

---

### `ButtonTag.astro`

**路径：** `src/components/control/ButtonTag.astro`

标签按钮。

| Prop | 类型 | 说明 |
|------|------|------|
| `size` | `string` (可选) | 尺寸 |
| `dot` | `boolean` (可选) | 是否显示左侧小圆点 |
| `href` | `string` (可选) | 链接 |
| `label` | `string` (可选) | aria-label |

默认内容通过 `<slot>` 传入。

**用法：**

```astro
<ButtonTag href={getTagUrl(t.name)} label="查看此标签的所有文章">
    {t.name.trim()}
</ButtonTag>
```

---

### `BackToTop.astro`

**路径：** `src/components/control/BackToTop.astro`

回到顶部浮动按钮。固定在页面右下侧，滚动超过 Banner 高度后显示。

**无需 Props。** 在 `MainGridLayout` 中自动包含。

---

## 6. 侧边栏小部件

### `SideBar.astro`

**路径：** `src/components/widget/SideBar.astro`

侧边栏容器。组合 `Profile`、`Categories`、`Tags` 组件。

| Prop | 类型 | 说明 |
|------|------|------|
| `class` | `string` (可选) | CSS class |
| `headings` | `MarkdownHeading[]` (可选) | 传递给 TOC |

由 `MainGridLayout` 自动使用。

---

### `Profile.astro`

**路径：** `src/components/widget/Profile.astro`

个人资料卡片：头像、名称、简介、社交链接。

数据来源：`src/config.ts` → `profileConfig`。

**无 Props。** 自动读取配置。

---

### `Categories.astro`

**路径：** `src/components/widget/Categories.astro`

分类列表卡片。从文章内容自动聚合分类。

| Prop | 类型 | 说明 |
|------|------|------|
| `class` | `string` (可选) | CSS class |
| `style` | `string` (可选) | 行内样式 |

**用法：**

```astro
<Categories class="onload-animation" style="animation-delay: 150ms" />
```

---

### `Tags.astro`

**路径：** `src/components/widget/Tags.astro`

标签列表卡片。从文章内容自动聚合标签。

| Prop | 类型 | 说明 |
|------|------|------|
| `class` | `string` (可选) | CSS class |
| `style` | `string` (可选) | 行内样式 |

**用法：**

```astro
<Tag class="onload-animation" style="animation-delay: 200ms" />
```

---

### `WidgetLayout.astro`

**路径：** `src/components/widget/WidgetLayout.astro`

小部件通用布局容器。提供标题、可折叠内容、展开按钮。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | — | DOM id，用于折叠控制 |
| `name` | `string` (可选) | — | 小部件标题 |
| `isCollapsed` | `boolean` (可选) | — | 是否折叠 |
| `collapsedHeight` | `string` (可选) | — | 折叠状态高度 |
| `class` | `string` (可选) | — | CSS class |
| `style` | `string` (可选) | — | 行内样式 |

默认内容通过 `<slot>` 传入。

```astro
<WidgetLayout name="标签" id="tags" isCollapsed={true} collapsedHeight="7.5rem">
    <div class="flex gap-2 flex-wrap">
        <ButtonTag>标签名</ButtonTag>
    </div>
</WidgetLayout>
```

---

### `NavMenuPanel.astro`

**路径：** `src/components/widget/NavMenuPanel.astro`

移动端导航菜单浮层面板。

| Prop | 类型 | 说明 |
|------|------|------|
| `links` | `NavBarLink[]` | 导航链接数组 |

由 Navbar 在移动端自动使用。

---

### `TOC.astro`

**路径：** `src/components/widget/TOC.astro`

文章目录组件。用自定义元素 `<table-of-contents>` + IntersectionObserver 实现高亮跟随。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `headings` | `MarkdownHeading[]` | `[]` | 文章标题层级数据 |
| `class` | `string` (可选) | — | CSS class |

仅在文章路由 (`/posts/`) 下渲染。

**用法：**

```astro
<TOC headings={headings} />
```

---

## 7. 杂项组件

### `ImageWrapper.astro`

**路径：** `src/components/misc/ImageWrapper.astro`

图像包裹组件。同时支持本地图片（通过 `import.meta.glob` 自动查找）和远程/公开图片。本地图片使用 Astro `<Image>` 优化输出。

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | — | 图片路径（相对/绝对/URL） |
| `alt` | `string` (可选) | — | 替代文本 |
| `class` | `string` (可选) | — | CSS class |
| `id` | `string` (可选) | — | DOM id |
| `position` | `string` | `"center"` | object-position 值 |
| `basePath` | `string` | `"/"` | 相对图片的基准路径 |

**相对路径解析规则：**

- 以 `/` 开头 → 从 `public/` 目录读取，通过 `<img>` 直接引用
- 以 `http`/`https`/`data:` 开头 → 远程图片，通过 `<img>` 直接引用
- 其他 → 本地图片，通过 `import.meta.glob` + Astro `<Image>` 优化

**用法：**

```astro
<!-- 本地图片（自动查找） -->
<ImageWrapper src="./example.png" alt="示例" class="w-full h-full" />

<!-- public 目录图片 -->
<ImageWrapper src="/favicon/favicon-light.png" alt="图标" />

<!-- 远程图片 -->
<ImageWrapper src="https://example.com/image.jpg" alt="远程图片" />

<!-- 带 basePath（文章内图片） -->
<ImageWrapper src={image} basePath={postImageBase} alt="文章封面" />
```

---

### `Markdown.astro`

**路径：** `src/components/misc/Markdown.astro`

Markdown 内容容器。应用 Tailwind Typography 样式（`prose dark:prose-invert`），并绑定代码复制按钮点击事件。

| Prop | 类型 | 说明 |
|------|------|------|
| `class` | `string` | CSS class |

```astro
<Markdown class="mb-6 markdown-content">
    <Content />
</Markdown>
```

**特性：** 自动为 `<Content />` 中的代码块复制按钮添加点击事件监听。

---

### `License.astro`

**路径：** `src/components/misc/License.astro`

文章底部版权许可信息块，显示 CC 协议。

| Prop | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 文章标题 |
| `slug` | `string` | 文章 slug |
| `pubDate` | `Date` | 发布日期 |
| `class` | `string` | CSS class |

**用法：**

```astro
<License
    title={entry.data.title}
    slug={entry.id}
    pubDate={entry.data.published}
    class="mb-6 rounded-xl"
/>
```

---

### `Navbar.astro`

**路径：** `src/components/Navbar.astro`

顶层导航栏。包含：站点标题、导航链接、搜索按钮、主题色设置、明暗切换、移动端菜单。

**无 Props。** 数据来源：`navBarConfig`（`src/config.ts`）。

---

### `Footer.astro`

**路径：** `src/components/Footer.astro`

页脚。显示版权年份、站点名称、RSS链接、Sitemap链接，及 Astro/Fuwari 致谢。

**无 Props。**

---

## 8. 特效组件

### `BackgroundParticles.astro`

**路径：** `src/components/BackgroundParticles.astro`

Canvas 粒子动效背景，响应色相变化。120 个粒子，连线距离 180px，使用 OKLCH 色值跟随主题色相。

**无 Props。** 由 `Layout.astro` 自动加载。

---

### `ConfigCarrier.astro`

**路径：** `src/components/ConfigCarrier.astro`

无样式 `<div>`，通过 `data-hue` 属性将主题色相值注入 DOM，供客户端 JS 读取。

**无 Props。** 数据来源：`siteConfig.themeColor.hue`。

---

### `GlobalStyles.astro`

**路径：** `src/components/GlobalStyles.astro`

当前为空组件（仅前端模板占位）。

---

## 9. Svelte 交互组件

这些是 Svelte 5 组件，通过 `client:only` 或 `client:load` 指令在客户端激活：

| 组件 | 路径 | 作用 |
|------|------|------|
| `StatusBar.svelte` | `src/components/StatusBar.svelte` | 实时状态栏（时间、天气、站长状态、一言） |
| `Search.svelte` | `src/components/Search.svelte` | 全文搜索（Pagefind 驱动） |
| `LightDarkSwitch.svelte` | `src/components/LightDarkSwitch.svelte` | 明暗主题切换 |
| `DisplaySettings.svelte` | `src/components/widget/DisplaySettings.svelte` | 色相滑块 + 锁定设置 |
| `AdminPanel.svelte` | `src/components/AdminPanel.svelte` | 后台管理面板 |
| `LoginForm.svelte` | `src/components/LoginForm.svelte` | 登录表单 |
| `RegisterForm.svelte` | `src/components/RegisterForm.svelte` | 注册表单 |
| `MarkdownEditor.svelte` | `src/components/MarkdownEditor.svelte` | CodeMirror 6 的 MDX 编辑器 |
| `ImageGallery.svelte` | `src/components/ImageGallery.svelte` | 图片画廊 |
| `ArchivePanel.svelte` | `src/components/ArchivePanel.svelte` | 文章归档面板 |
| `StatusHistory.svelte` | `src/components/StatusHistory.svelte` | 状态记录历史 |

使用方式示例：

```astro
<StatusBar client:only="svelte" />
<Search client:only="svelte" />
<LightDarkSwitch client:only="svelte" />
<DisplaySettings client:only="svelte" />
<AdminPanel client:only="svelte" />
```

---

## 10. 组件组合模式

### 首页组合

```astro
<MainGridLayout>
    <PostPage page={page} />              <!-- 文章列表 -->
    <Pagination page={page} />            <!-- 分页 -->
</MainGridLayout>
```

### 文章页组合

```astro
<MainGridLayout title={entry.data.title} headings={mergedHeadings}>
    <PostMetadata published updated tags category />
    <ImageWrapper src={image} />          <!-- 文章封面 -->
    <Markdown>
        <Content />                       <!-- MDX 渲染内容 -->
    </Markdown>
    <License title slug pubDate />        <!-- 版权许可 -->
    <!-- 上下篇导航按钮 -->
</MainGridLayout>
```

### 布局层级链

```
Layout.astro (HTML shell + 全局资源)
  └─ BackgroundParticles       ← Canvas 粒子 (z-index: 0)
  └─ ConfigCarrier             ← 主题色相透传
  └─ <slot />
      └─ MainGridLayout.astro
          ├─ Navbar.astro
          │   ├─ Search.svelte
          │   ├─ LightDarkSwitch.svelte
          │   └─ NavMenuPanel.astro
          ├─ Banner + 波浪 SVG
          ├─ StatusBar.svelte
          ├─ SideBar.astro
          │   ├─ Profile.astro
          │   ├─ Categories.astro
          │   │   └─ ButtonLink
          │   └─ Tags.astro
          │       └─ ButtonTag
          ├─ main (页面核心内容)
          ├─ TOC.astro
          ├─ Footer.astro
          └─ BackToTop.astro
```

---

## 附录：数据来源与配置

组件的很多数据从 `src/config.ts` 读取：

| 配置导出 | 使用组件 |
|----------|----------|
| `siteConfig` | Layout、MainGridLayout、Navbar、ConfigCarrier、TOC |
| `navBarConfig` | Navbar、NavMenuPanel |
| `profileConfig` | Profile、Footer、License、Layout |
| `licenseConfig` | License |
| `expressiveCodeConfig` | astro.config.mjs |

路径别名：

- `@components/` → `src/components/`
- `@layouts/` → `src/layouts/`
- `@utils/` → `src/utils/`
- `@constants/` → `src/constants/`
- `@i18n/` → `src/i18n/`
- `@assets/` → `src/assets/`
- `@/*` → `src/*`
