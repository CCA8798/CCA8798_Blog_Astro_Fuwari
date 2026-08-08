<script lang="ts">
import { init } from "@waline/client";
import "@waline/client/waline.css";
import { onDestroy, onMount } from "svelte";

interface MeResponse {
	loggedIn: boolean;
	username?: string;
	displayName?: string;
	group?: string;
	walineToken?: string | null;
}

let { path } = $props<{ path: string }>();

let walineInstance: ReturnType<typeof init> = null;

// Walwine 的登录态会同时写入 localStorage 与 sessionStorage(WALINE_USER):
// 其自带登出按钮会把两处都写成字符串 "null",且读取时以 sessionStorage 为准。
// 因此 bridge 必须同步维护两处,否则残留的 "null" 会让 Walwine 仍认为未登录。
const removeWalineUser = (): void => {
	localStorage.removeItem("WALINE_USER");
	sessionStorage.removeItem("WALINE_USER");
};

const bridgeLogin = async (): Promise<void> => {
	const adminToken = localStorage.getItem("admin_token");
	if (!adminToken) {
		removeWalineUser();
		return;
	}

	try {
		const response = await fetch("/api/me", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		if (!response.ok) {
			removeWalineUser();
			return;
		}

		const data = (await response.json()) as MeResponse;
		if (!data.loggedIn || !data.walineToken) {
			removeWalineUser();
			return;
		}

		const displayName = data.displayName || data.username || "";
		const walineUser = {
			token: data.walineToken,
			display_name: displayName,
			email: `${data.username}@waline.cca8798.com`,
			type: data.group === "admin" ? "administrator" : "guest",
			avatar: "",
		};
		localStorage.setItem("WALINE_USER", JSON.stringify(walineUser));
		sessionStorage.setItem("WALINE_USER", JSON.stringify(walineUser));
	} catch {
		removeWalineUser();
	}
};

// Waline 客户端要求 serverURL 必须是绝对 URL（http(s):// 或 // 开头）。
// 相对路径 /waline 会被其内部分析为 https://waline（host 错误），导致全部 API 失败。
const absoluteWalineServerURL = () => `${window.location.origin}/waline`;

// 中文 locale.login 的值，用于识别「登录」按钮
const loginText = "登录";

// 拦截 Waline 自带的「登录」按钮（login=force 且未登录时渲染在 wl-login-info 提示条中）。
// 该按钮默认跳转 Waline 后台 /waline/ui/login（邮箱+密码），对站内用户无意义，
// 改为跳转站内登录页 /login。用 capture 阶段监听，才能在 Waline 内部 Vue 处理器之前拦截。
const attachLoginRedirect = (): void => {
	const container = document.querySelector<HTMLElement>("#waline-comment");
	if (!container) return;

	container.addEventListener(
		"click",
		(e: Event) => {
			const target = e.target as HTMLElement;
			const button = target.closest("button.wl-btn");
			if (button) {
				// 只拦截「登录」按钮，不影响已登录用户的其它按钮操作
				if (button.textContent?.trim() !== loginText) return;
				// 已登录（存在 admin_token）时不拦截
				if (localStorage.getItem("admin_token")) return;

				e.preventDefault();
				e.stopImmediatePropagation();
				window.location.href = "/login";
				return;
			}

			// 已登录用户卡（wl-login-info）中的昵称/头像链接：Waline 默认打开
			// window.open(serverURL + /ui/profile)，而本站未部署 Waline 后台 UI，
			// 会落到 /waline/ui/profile 404。拦截后不跳转（账户管理已由顶部
			// navbar 的账户菜单提供，避免普通用户误入后台）。
			const profileLink = target.closest<HTMLAnchorElement>("a.wl-login-nick");
			if (profileLink) {
				e.preventDefault();
				e.stopImmediatePropagation();
			}
		},
		true,
	);
};

const initWalineInstance = async (): Promise<void> => {
	await bridgeLogin();
	walineInstance?.destroy();
	walineInstance = init({
		el: "#waline-comment",
		serverURL: absoluteWalineServerURL(),
		path,
		lang: "zh-CN",
		dark: "html.dark",
		// force：未登录（无 admin_token）时不渲染评论表单，仅显示 wl-login-info 提示条
		login: "force",
		pageview: false,
		reaction: false,
		emoji: false,
		// 语义化评论表单文案（昵称/邮箱/网址三个填写框提示更清晰）
		locale: {
			nickname: "昵称",
			nicknameError: "昵称不能少于 3 个字符",
			mail: "邮箱",
			mailError: "请填写正确的邮箱地址（仅用于接收回复通知）",
			link: "网址",
			linkOptional: "选填",
			placeholder: "写下你的想法，友善交流～",
			submit: "提交评论",
		},
	});
	// 拦截 Waline 自带「登录」按钮与已登录用户卡跳转（事件委托，Waline 异步渲染后也能捕获）
	attachLoginRedirect();
};

// 站点侧登出(AccountMenu 清空 localStorage 后派发)无法直接让 Walwine
// 失效——它的登录态存于模块级内存(不受外部清存储影响)。因此这里点击
// Walwine 自带的登出按钮(.wl-logout-btn),由它内部清内存态并立即重渲染
// 为未登录(等价于用户手动点击「退出」),无需手动 F5。
const logoutWaline = (): void => {
	const logoutBtn = document.querySelector<HTMLButtonElement>(".wl-logout-btn");
	if (logoutBtn) {
		logoutBtn.click();
	}
};

onMount(async () => {
	await initWalineInstance();
	// 站内右上角账户菜单登出后,评论区立即跟随变为未登录(无需手动 F5)
	window.addEventListener("waline:auth-changed", logoutWaline);
});

onDestroy(() => {
	window.removeEventListener("waline:auth-changed", logoutWaline);
	walineInstance?.destroy();
	walineInstance = null;
});
</script>

<div id="waline-comment" class="mt-8 comment-container"></div>

<style>
	/* ---- 评论面板主题对接：Waline 变量 → 站点主题变量 ---- */
	:global(.comment-container) {
		/* 字体：站点正文 14px，评论列表与输入框调大至 15px，标题 16px */
		--waline-font-size: 1.25rem;
		/* 主题色：跟随站点主色（--primary 已随 -hue 与明暗变化） */
		--waline-theme-color: var(--primary);
		--waline-active-color: var(--primary);
		/* 文字颜色 */
		--waline-color: var(--deep-text);
		--waline-light-grey: var(--meta-divider);
		--waline-dark-grey: var(--deep-text);
		/* 背景与边框 */
		--waline-bg-color: var(--card-bg);
		--waline-bg-color-light: var(--btn-regular-bg);
		--waline-bg-color-hover: var(--btn-regular-bg-hover);
		--waline-border-color: var(--line-color);
		--waline-disable-bg-color: var(--btn-regular-bg);
		/* 代码/引用块 */
		--waline-code-bg-color: var(--codeblock-bg);
		--waline-bq-color: var(--primary);
		box-shadow: none;
	}

	/* Waline 注入的 html.dark{--waline-*} 会覆盖祖先变量，此层换用站点变量保持主题一致 */
	:global(html.dark) .comment-container {
		/* 深色模式下 --waline-white 用于按钮文字色，必须用浅色，否则「提交评论」按钮文字变黑看不清 */
		--waline-white: oklch(0.95 0.01 var(--hue));
		--waline-bg-color: var(--card-bg);
		--waline-bg-color-light: var(--btn-regular-bg);
		--waline-bg-color-hover: var(--btn-regular-bg-hover);
		--waline-border-color: var(--line-color);
		--waline-border: 1px solid var(--line-color);
		--waline-color: var(--deep-text);
		--waline-light-grey: var(--meta-divider);
		--waline-dark-grey: var(--deep-text);
		--waline-disable-bg-color: var(--btn-regular-bg);
		--waline-disable-color: var(--deep-text);
		--waline-code-bg-color: var(--codeblock-bg);
	}

	/* 输入控件字号强制 15px，防止被 Waline 固定小字号覆盖 */
	:global(.comment-container .wl-form input),
	:global(.comment-container .wl-form textarea) {
		font-size: 1.25rem;
	}

	/* 评论列表正文 */
	:global(.comment-container .wl-content) {
		font-size: 1.25rem;
		line-height: 1.7;
	}

	/* 信息提示条字号单独控制 */
	:global(.comment-container .wl-info) {
		font-size: 1.25rem;
	}

	/* 用户要求不显示头像框：隐藏评论区头像元素 */
	:global(.comment-container .wl-avatar),
	:global(.comment-container .wl-user-avatar) {
		display: none;
	}

	/* 评论昵称单行显示：过长用省略号截断，保证不换行（.wl-head 默认 overflow:hidden 保持） */
	:global(.comment-container .wl-card .wl-head .wl-nick) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 14em;
	}

	/* 预览面板标题「预览:」显式设置颜色，避免深色模式下继承黑色看不清 */
	:global(.comment-container .wl-preview h4) {
		color: var(--deep-text);
	}
	:global(html.dark .comment-container .wl-preview h4) {
		color: var(--deep-text);
	}

	/* 评论区标题「评论 N」与排序栏：waline.css 未设色，深色下继承 body 默认黑色 -> 显式浅色 */
	:global(html.dark .comment-container .wl-meta-head),
	:global(html.dark .comment-container .wl-meta-head .wl-count) {
		color: var(--deep-text);
	}

	/* 已登录用户卡退出按钮图标：点击区域小且默认继承黑 -> 深色下用浅色 */
	:global(html.dark .comment-container .wl-logout-btn) {
		color: var(--deep-text);
	}

	/* 已登录用户卡：加宽容器（默认 max-width:80px 会把中文昵称挤成两行） */
	:global(.comment-container .wl-login-info) {
		max-width: 14em;
	}

	/* 已登录用户昵称：单行显示，过长省略号截断 */
	:global(.comment-container .wl-login-info .wl-login-nick) {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12em;
		display: inline-block;
		vertical-align: middle;
	}
</style>