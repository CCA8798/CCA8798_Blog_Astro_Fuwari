<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";

interface AdminUser {
	username: string;
	displayName: string;
	group: string;
	bio?: string;
}

interface ProfileUpdateResponse {
	success?: boolean;
	user?: AdminUser;
	walineToken?: string;
	error?: string;
}

interface MeResponse {
	loggedIn: boolean;
	username?: string;
	displayName?: string;
	group?: string;
	walineToken?: string | null;
}

let loggedIn = $state(false);
let user = $state<AdminUser | null>(null);
let panelOpen = $state(false);
let container: HTMLDivElement | undefined = $state();

// 修改个人资料表单
let displayName = $state("");
let bio = $state("");
let password = $state("");
let confirmPassword = $state("");
let saving = $state(false);
let message = $state("");
let messageType = $state<"success" | "error">("success");

function groupLabel(group: string): string {
	if (group === "admin") return "管理员";
	if (group === "editor") return "编辑";
	return "访客";
}

function loadFromStorage(): void {
	const token = localStorage.getItem("admin_token");
	const raw = localStorage.getItem("admin_user");
	if (!token) {
		loggedIn = false;
		user = null;
		return;
	}
	loggedIn = true;
	if (raw) {
		try {
			user = JSON.parse(raw) as AdminUser;
		} catch {
			user = null;
		}
	} else {
		user = null;
	}
	if (user) {
		displayName = user.displayName || user.username || "";
		bio = user.bio || "";
	}
}

function togglePanel(): void {
	panelOpen = !panelOpen;
}

function closePanel(): void {
	panelOpen = false;
}

function handleDocumentClick(e: MouseEvent): void {
	if (!container || !panelOpen) return;
	const target = e.target as Node;
	if (!container.contains(target)) {
		panelOpen = false;
	}
}

onMount(() => {
	loadFromStorage();
	document.addEventListener("click", handleDocumentClick);
	return () => {
		document.removeEventListener("click", handleDocumentClick);
	};
});

/** 从 /api/me 拉取最新 walineToken 并写入 WALINE_USER（与 WalineComment 的 bridgeLogin 结构一致） */
async function refreshWalineUser(): Promise<void> {
	const adminToken = localStorage.getItem("admin_token");
	if (!adminToken) return;
	try {
		const response = await fetch("/api/me", {
			headers: { Authorization: `Bearer ${adminToken}` },
		});
		if (!response.ok) return;
		const data = (await response.json()) as MeResponse;
		if (!data.loggedIn || !data.walineToken) return;
		const walineUser = {
			token: data.walineToken,
			display_name: data.displayName || data.username || "",
			email: `${data.username}@waline.cca8798.com`,
			type: data.group === "admin" ? "administrator" : "guest",
			avatar: "",
		};
		localStorage.setItem("WALINE_USER", JSON.stringify(walineUser));
	} catch {
		/* ignore */
	}
}

async function saveProfile(): Promise<void> {
	if (!user) return;
	if (password && password.length < 6) {
		message = "密码至少 6 个字符";
		messageType = "error";
		return;
	}
	if (password && password !== confirmPassword) {
		message = "两次输入的密码不一致";
		messageType = "error";
		return;
	}
	saving = true;
	message = "";
	try {
		const body: Record<string, unknown> = {
			action: "profileUpdate",
			token: localStorage.getItem("admin_token"),
			bio: bio.trim(),
		};
		if (displayName.trim()) body.displayName = displayName.trim();
		if (password) {
			body.password = password;
			body.confirmPassword = confirmPassword;
		}
		const res = await fetch("/api/admin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = (await res.json()) as ProfileUpdateResponse;
		if (res.ok && data.success && data.user) {
			localStorage.setItem("admin_user", JSON.stringify(data.user));
			user = data.user;
			password = "";
			confirmPassword = "";
			await refreshWalineUser();
			message = "保存成功";
			messageType = "success";
		} else {
			message = data.error || "保存失败";
			messageType = "error";
		}
	} catch {
		message = "网络错误";
		messageType = "error";
	}
	saving = false;
}

async function handleLogout(): Promise<void> {
	const adminToken = localStorage.getItem("admin_token");
	try {
		if (adminToken) {
			await fetch("/api/admin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "logout", token: adminToken }),
			});
		}
	} catch {
		// ignore API errors, always clear local state
	}
	localStorage.removeItem("admin_token");
	localStorage.removeItem("admin_user");
	localStorage.removeItem("WALINE_USER");
	loggedIn = false;
	user = null;
	panelOpen = false;
	// 通知 Waline 评论区立即切换为未登录态（无需手动刷新页面）
	window.dispatchEvent(new Event("waline:auth-changed"));
}
</script>

<!-- z-50 make the panel higher than other float panels -->
<div class="relative z-50" bind:this={container}>
    <button aria-label="账户" class="btn-plain scale-animation rounded-lg h-11 px-2 active:scale-90" onclick={togglePanel}>
        {#if loggedIn && user}
            <span class="text-sm font-medium max-w-[4.5rem] truncate">{user.displayName || user.username}</span>
        {:else}
            <Icon icon="material-symbols:account-circle-outline" class="text-[1.25rem]"></Icon>
        {/if}
    </button>

    <div class="absolute right-0 top-11 pt-5 transition" class:float-panel-closed={!panelOpen}>
        <div class="card-base float-panel p-3 w-72 max-sm:w-64">
            {#if loggedIn && user}
                <!-- 当前用户信息 -->
                <div class="flex items-center gap-3 px-2 py-2">
                    <div class="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                        <Icon icon="material-symbols:account-circle-outline" class="text-[1.5rem]"></Icon>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-75 truncate">{user.displayName || user.username}</span>
                            <span class={`text-[0.6rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                    user.group === "admin"
                                        ? "bg-[var(--primary)]/15 text-[var(--primary)] dark:text-white"
                                        : user.group === "editor"
                                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                          : "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400"
                                }`}>
                                {groupLabel(user.group)}
                            </span>
                        </div>
                        <div class="text-xs text-50 font-mono truncate">@{user.username}</div>
                    </div>
                </div>

                {#if user.group === "admin" || user.group === "editor"}
                    <a href="/admin" onclick={closePanel}
                       class="flex items-center gap-2 w-full btn-plain scale-animation rounded-lg h-9 px-3 font-medium active:scale-95 mb-1 text-sm">
                        <Icon icon="material-symbols:admin-panel-settings-outline" class="text-[1.25rem]"></Icon>
                        管理后台
                    </a>
                {/if}

                <!-- 修改个人资料 -->
                <div class="mt-2 pt-2 border-t border-dashed border-[var(--line-divider)]">
                    <div class="text-xs font-medium text-50 tracking-wide px-2 pb-2">修改个人资料</div>
                    <input type="text" bind:value={displayName} placeholder="昵称"
                           class="w-full text-sm px-3 py-2 border border-[var(--line-color)] rounded-lg text-75 placeholder-neutral-400/60 focus:outline-none focus:border-[var(--primary)] transition mb-2" />
                    <textarea bind:value={bio} placeholder="简介" rows="2"
                              class="w-full text-sm px-3 py-2 border border-[var(--line-color)] rounded-lg text-75 placeholder-neutral-400/60 focus:outline-none focus:border-[var(--primary)] transition mb-2"></textarea>
                    <input type="password" bind:value={password} placeholder="新密码（留空不修改）"
                           class="w-full text-sm px-3 py-2 border border-[var(--line-color)] rounded-lg text-75 placeholder-neutral-400/60 focus:outline-none focus:border-[var(--primary)] transition mb-2" />
                    <input type="password" bind:value={confirmPassword} placeholder="确认新密码"
                           class="w-full text-sm px-3 py-2 border border-[var(--line-color)] rounded-lg text-75 placeholder-neutral-400/60 focus:outline-none focus:border-[var(--primary)] transition mb-2" />
                    {#if message}
                        <div class={`text-xs rounded-lg px-3 py-2 mb-2 ${
                                messageType === "success"
                                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                    : "bg-red-500/10 text-red-500"
                            }`}>
                            {message}
                        </div>
                    {/if}
                    <button onclick={saveProfile} disabled={saving}
                            class="w-full py-2 rounded-lg text-sm font-medium tracking-wider
                                bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
                                disabled:opacity-40 transition">
                        {saving ? "保存中…" : "保存修改"}
                    </button>
                </div>

                <!-- 退出登录 -->
                <button onclick={handleLogout}
                        class="w-full mt-2 flex items-center justify-center gap-2 rounded-lg h-9 text-sm text-red-500 hover:bg-red-500/10 transition">
                    <Icon icon="material-symbols:logout" class="text-[1.1rem]"></Icon>
                    退出登录
                </button>
            {:else}
                <!-- 未登录 -->
                <div class="p-2">
                    <button onclick={() => { window.location.href = "/login"; }}
                            class="flex items-center justify-center gap-2 w-full btn-plain scale-animation rounded-lg h-9 px-3 font-medium active:scale-95 text-sm">
                        <Icon icon="material-symbols:login" class="text-[1.25rem]"></Icon>
                        登录
                    </button>
                    <button onclick={() => { window.location.href = "/register"; }}
                            class="flex items-center justify-center gap-2 w-full btn-plain scale-animation rounded-lg h-9 px-3 font-medium active:scale-95 mt-1 text-sm">
                        <Icon icon="material-symbols:person-add" class="text-[1.25rem]"></Icon>
                        注册
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    input, textarea {
        background: var(--page-bg);
        color: var(--deep-text);
    }
    textarea {
        resize: vertical;
    }
</style>