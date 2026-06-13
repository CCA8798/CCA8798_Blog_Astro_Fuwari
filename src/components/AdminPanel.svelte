<script lang="ts">
import { onMount } from "svelte";
import { fade, slide } from "svelte/transition";
import { DARK_MODE, LIGHT_MODE } from "../constants/constants";
import {
	applyThemeToDocument,
	getStoredTheme,
	setTheme,
} from "../utils/setting-utils";

interface HistoryEntry {
	id: string;
	text: string;
	updatedAt: string | null;
}

interface StatusData {
	current: HistoryEntry;
	history: HistoryEntry[];
}

let loggedIn = $state(false);
let token = $state("");
let loading = $state(true);
let statusData = $state<StatusData | null>(null);
let currentUser = $state<{
	username: string;
	displayName: string;
	group: string;
} | null>(null);

// Login form
let loginUsername = $state("");
let loginPassword = $state("");
let loginError = $state("");
let loginLoading = $state(false);

// Update current status
let newStatusText = $state("");
let updateLoading = $state(false);
let updateError = $state("");

// Create history entry
let createText = $state("");
let createLoading = $state(false);
let createError = $state("");

// Edit entry
let editingId = $state<string | null>(null);
let editText = $state("");
let editLoading = $state(false);
let editError = $state("");

// Delete confirmation (status)
let deletingId = $state<string | null>(null);
let deletingEntry = $state<HistoryEntry | null>(null);
let deleteLoading = $state(false);

// Tab navigation
let activeTab = $state<"status" | "posts" | "users">("status");

// Post list
let postList = $state<PostInfo[]>([]);
let postListLoading = $state(false);

// Post editor
interface PostInfo {
	slug: string;
	title: string;
	published: string;
	draft: boolean;
	tags: string[];
	category: string;
	description: string;
	author: string;
}
interface PostFull extends PostInfo {
	body: string;
}

let showPostEditor = $state(false);
let postEditorMode = $state<"create" | "edit">("create");
let postSlug = $state("");
let postTitle = $state("");
let postPublished = $state("");
let postDraft = $state(false);
let postTags = $state("");
let postCategory = $state("");
let postDescription = $state("");
let postAuthor = $state("");
let postBody = $state("");
let postSaving = $state(false);
let postError = $state("");

// Theme toggle
let currentTheme = $state<string>(DARK_MODE);

// Post delete
let deletingPostSlug = $state<string | null>(null);
let deletingPostTitle = $state("");
let postDeleteLoading = $state(false);

// User management
interface UserInfo {
	username: string;
	displayName: string;
	group: string;
	createdAt: string;
	bio: string;
	hasPassword: boolean;
}
let userList = $state<UserInfo[]>([]);
let userListLoading = $state(false);
let showUserEditor = $state(false);
let userEditMode = $state<"create" | "edit">("create");
let userEditUsername = $state("");
let userEditDisplayName = $state("");
let userEditPassword = $state("");
let userEditGroup = $state("viewer");
let userEditBio = $state("");
let userSaving = $state(false);
let userError = $state("");
let deletingUsername = $state<string | null>(null);
let userDeleteLoading = $state(false);

onMount(() => {
	currentTheme = getStoredTheme();
	const saved = localStorage.getItem("admin_token");
	const savedUser = localStorage.getItem("admin_user");
	if (saved) {
		token = saved;
		loggedIn = true;
		if (savedUser) {
			try {
				currentUser = JSON.parse(savedUser);
			} catch {
				currentUser = null;
			}
		}
		fetchData();
	} else {
		loading = false;
	}
});

function toggleTheme() {
	const next = currentTheme === DARK_MODE ? LIGHT_MODE : DARK_MODE;
	currentTheme = next;
	setTheme(next);
}

async function api(action: string, extra: Record<string, unknown> = {}) {
	const body: Record<string, unknown> = { action, ...extra };
	if (loggedIn && token) body.token = token;
	const res = await fetch("/api/admin", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = await res.json();
	if (!res.ok && action !== "login" && action !== "logout") {
		if (res.status === 401) {
			logout();
		}
	}
	return { ok: res.ok, status: res.status, data };
}

async function handleLogin() {
	loginLoading = true;
	loginError = "";
	const { ok, data } = await api("login", {
		username: loginUsername,
		password: loginPassword,
	});
	if (ok) {
		token = data.token;
		loggedIn = true;
		currentUser = data.user || null;
		localStorage.setItem("admin_token", token);
		if (currentUser)
			localStorage.setItem("admin_user", JSON.stringify(currentUser));
		loginUsername = "";
		loginPassword = "";
		fetchData();
	} else {
		loginError = data.error || "登录失败";
	}
	loginLoading = false;
}

async function fetchData() {
	loading = true;
	try {
		const { ok, data } = await api("list");
		if (ok) {
			statusData = data;
		}
	} catch {
		// ignore
	}
	loading = false;
}

async function handleUpdateCurrent() {
	if (!newStatusText.trim()) return;
	updateLoading = true;
	updateError = "";
	const { ok, data } = await api("updateCurrent", {
		text: newStatusText.trim(),
	});
	if (ok) {
		newStatusText = "";
		fetchData();
	} else {
		updateError = data.error || "更新失败";
	}
	updateLoading = false;
}

async function handleCreate() {
	if (!createText.trim()) return;
	createLoading = true;
	createError = "";
	const { ok, data } = await api("create", { text: createText.trim() });
	if (ok) {
		createText = "";
		fetchData();
	} else {
		createError = data.error || "创建失败";
	}
	createLoading = false;
}

async function handleSaveEdit() {
	if (!editText.trim() || !editingId) return;
	editLoading = true;
	editError = "";
	const { ok, data } = await api("edit", {
		id: editingId,
		text: editText.trim(),
	});
	if (ok) {
		editingId = null;
		editText = "";
		fetchData();
	} else {
		editError = data.error || "编辑失败";
	}
	editLoading = false;
}

function startEdit(entry: HistoryEntry) {
	editingId = entry.id;
	editText = entry.text;
	editError = "";
}

function cancelEdit() {
	editingId = null;
	editText = "";
	editError = "";
}

async function confirmDelete(entry: HistoryEntry) {
	deletingEntry = entry;
	deletingId = entry.id;
}

async function handleDelete() {
	if (!deletingId) return;
	deleteLoading = true;
	const { ok } = await api("delete", { id: deletingId });
	if (ok) {
		deletingEntry = null;
		deletingId = null;
		fetchData();
	}
	deleteLoading = false;
}

function cancelDelete() {
	deletingEntry = null;
	deletingId = null;
}

async function logout() {
	try {
		await api("logout");
	} catch {
		// ignore API errors, always clear local state
	}
	token = "";
	loggedIn = false;
	currentUser = null;
	statusData = null;
	localStorage.removeItem("admin_token");
	localStorage.removeItem("admin_user");
}

function formatTime(iso: string | null): string {
	if (!iso) return "-";
	const d = new Date(iso);
	return d.toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

function formatDateShort(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
	} catch {
		return iso;
	}
}

// --- Post CRUD ---

async function fetchPostList() {
	postListLoading = true;
	const { ok, data } = await api("postList");
	if (ok) postList = data as PostInfo[];
	postListLoading = false;
}

function openNewPost() {
	postEditorMode = "create";
	postSlug = "";
	postTitle = "";
	postPublished = new Date().toISOString().slice(0, 16);
	postDraft = true;
	postTags = "";
	postCategory = "";
	postDescription = "";
	postAuthor = currentUser?.username || "";
	postBody = "";
	postError = "";
	showPostEditor = true;
}

async function openEditPost(slug: string) {
	postEditorMode = "edit";
	postError = "";
	showPostEditor = true;
	const { ok, data } = await api("postGet", { slug });
	if (ok) {
		const p = data as PostFull;
		postSlug = p.slug;
		postTitle = p.title;
		postPublished = p.published ? p.published.slice(0, 16) : "";
		postDraft = p.draft;
		postTags = (p.tags || []).join(", ");
		postCategory = p.category || "";
		postDescription = p.description || "";
		postAuthor = p.author || "";
		postBody = p.body || "";
	} else {
		postError = data.error || "获取文章失败";
		showPostEditor = false;
	}
}

function closePostEditor() {
	showPostEditor = false;
	postError = "";
}

async function handleSavePost() {
	if (!postSlug.trim() || !postTitle.trim()) {
		postError = "slug 和标题不能为空";
		return;
	}
	postSaving = true;
	postError = "";
	const tags = postTags
		.split(/[,，]/)
		.map((t) => t.trim())
		.filter(Boolean);
	const pub = postPublished
		? postPublished + ":00+08:00"
		: new Date().toISOString();
	const action = postEditorMode === "create" ? "postCreate" : "postUpdate";
	const { ok, data } = await api(action, {
		slug: postSlug.trim(),
		title: postTitle.trim(),
		published: pub,
		draft: postDraft,
		tags,
		category: postCategory.trim(),
		description: postDescription.trim(),
		author: postAuthor.trim(),
		body: postBody,
	});
	if (ok) {
		showPostEditor = false;
		fetchPostList();
	} else {
		postError = data.error || "保存失败";
	}
	postSaving = false;
}

function confirmDeletePost(slug: string, title: string) {
	deletingPostSlug = slug;
	deletingPostTitle = title;
}

async function handleDeletePost() {
	if (!deletingPostSlug) return;
	postDeleteLoading = true;
	const { ok } = await api("postDelete", { slug: deletingPostSlug });
	if (ok) {
		deletingPostSlug = null;
		deletingPostTitle = "";
		fetchPostList();
	}
	postDeleteLoading = false;
}

function cancelDeletePost() {
	deletingPostSlug = null;
	deletingPostTitle = "";
}

// --- User management ---

async function fetchUserList() {
	userListLoading = true;
	const { ok, data } = await api("userList");
	if (ok) userList = data as UserInfo[];
	userListLoading = false;
}

function openNewUser() {
	userEditMode = "create";
	userEditUsername = "";
	userEditDisplayName = "";
	userEditPassword = "";
	userEditGroup = "viewer";
	userEditBio = "";
	userError = "";
	showUserEditor = true;
}

function openEditUser(user: UserInfo) {
	userEditMode = "edit";
	userEditUsername = user.username;
	userEditDisplayName = user.displayName;
	userEditPassword = "";
	userEditGroup = user.group;
	userEditBio = user.bio || "";
	userError = "";
	showUserEditor = true;
}

function closeUserEditor() {
	showUserEditor = false;
	userError = "";
}

async function handleSaveUser() {
	if (
		userEditMode === "create" &&
		(!userEditUsername.trim() || !userEditPassword.trim())
	) {
		userError = "用户名和密码不能为空";
		return;
	}
	userSaving = true;
	userError = "";
	const action = userEditMode === "create" ? "userCreate" : "userUpdate";
	const body: Record<string, unknown> = {
		username: userEditUsername.trim(),
		displayName: userEditDisplayName.trim() || userEditUsername.trim(),
		userGroup: userEditGroup,
		userBio: userEditBio.trim(),
	};
	if (userEditPassword.trim()) body.userPassword = userEditPassword.trim();
	const { ok, data } = await api(action, body);
	if (ok) {
		showUserEditor = false;
		fetchUserList();
	} else {
		userError = data.error || "保存失败";
	}
	userSaving = false;
}

function confirmDeleteUser(username: string) {
	deletingUsername = username;
}

async function handleDeleteUser() {
	if (!deletingUsername) return;
	userDeleteLoading = true;
	const { ok } = await api("userDelete", { username: deletingUsername });
	if (ok) {
		deletingUsername = null;
		fetchUserList();
	}
	userDeleteLoading = false;
}

function cancelDeleteUser() {
	deletingUsername = null;
}
</script>

<div class="min-h-screen bg-[var(--page-bg)] text-75 py-12 px-4 max-sm:py-6 max-sm:px-3">
	<div class="admin-card max-w-2xl mx-auto p-6 sm:p-8 max-sm:p-5 onload-animation">

		<!-- Header -->
		<div class="flex justify-between items-center pb-4 mb-6 border-b border-dashed border-[var(--line-divider)]">
			<h1 class="flex items-center gap-2.5 text-lg font-semibold tracking-wider">
				<span class="w-[3px] h-5 rounded-sm bg-[var(--primary)]"></span>
				后台管理
				{#if currentUser}
					<span class="text-xs font-normal text-50 ml-2 px-2 py-0.5 rounded-full bg-[var(--primary)]/10">
						{currentUser.displayName}
						<span class="opacity-60 ml-1">
							({currentUser.group === 'admin' ? '管理员' : currentUser.group === 'editor' ? '编辑' : '用户'})
						</span>
					</span>
				{/if}
			</h1>
			<div class="flex items-center gap-2 text-xs tracking-wide">
				<button onclick={toggleTheme} title="切换主题"
					class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition">
					{#if currentTheme === DARK_MODE}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
					{/if}
				</button>
				<a href="/" class="text-[var(--primary)] hover:opacity-75 transition">← 返回主站</a>
				{#if loggedIn}
					<button onclick={logout}
						class="text-neutral-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg transition">
						退出登录
					</button>
				{/if}
			</div>
		</div>

		{#if !loggedIn}
			<div transition:fade={{ duration: 200 }} class="py-12 flex flex-col items-center justify-center gap-4 text-50 text-sm tracking-wider">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-60"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M2.1 13.1a.97.97 0 0 1 0-2.2 8.69 8.69 0 0 0 5.15-5.89.97.97 0 0 1 1.87 0 8.69 8.69 0 0 0 5.15 5.89.97.97 0 0 1 0 2.2 8.69 8.69 0 0 0-5.15 5.89.97.97 0 0 1-1.87 0 8.69 8.69 0 0 0-5.15-5.89Z"/></svg>
				<span>请先登录</span>
				<a href="/login" class="px-5 py-2 rounded-lg text-sm font-medium tracking-wider
					bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97] transition">
					前往登录
				</a>
			</div>

		{:else if loading}
			<div transition:fade={{ duration: 200 }} class="py-12 flex items-center justify-center gap-3 text-50 text-sm tracking-wider">
				<span class="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
				加载中…
			</div>

		{:else}
			<!-- ===== Tab Navigation ===== -->
			<div class="flex gap-1 mb-6 pb-1 border-b border-[var(--line-color)]">
				<button onclick={() => { activeTab = "status"; }}
					class="px-4 py-2 text-sm tracking-wider rounded-t-lg transition
						class:text-[var(--primary)]={activeTab === "status"}
						class:border-b-2={activeTab === "status"}
						class:border-[var(--primary)]={activeTab === "status"}
						class:text-50={activeTab !== "status"}
						class:border-b-2={activeTab !== "status"}
						class:border-transparent={activeTab !== "status"}">
					状态管理
				</button>
				<button onclick={() => { activeTab = "posts"; fetchPostList(); }}
					class="px-4 py-2 text-sm tracking-wider rounded-t-lg transition
						class:text-[var(--primary)]={activeTab === "posts"}
						class:border-b-2={activeTab === "posts"}
						class:border-[var(--primary)]={activeTab === "posts"}
						class:text-50={activeTab !== "posts"}
						class:border-b-2={activeTab !== "posts"}
						class:border-transparent={activeTab !== "posts"}">
					文章管理
				</button>
				{#if currentUser?.group === "admin"}
					<button onclick={() => { activeTab = "users"; fetchUserList(); }}
						class="px-4 py-2 text-sm tracking-wider rounded-t-lg transition
							class:text-[var(--primary)]={activeTab === "users"}
							class:border-b-2={activeTab === "users"}
							class:border-[var(--primary)]={activeTab === "users"}
							class:text-50={activeTab !== "users"}
							class:border-b-2={activeTab !== "users"}
							class:border-transparent={activeTab !== "users"}">
						用户管理
					</button>
				{/if}
			</div>

			{#if activeTab === "status"}
				<!-- ===== Current Status ===== -->
				<div transition:fade={{ duration: 150 }} class="mb-6 pb-5 border-b border-dashed border-[var(--line-divider)]">
					<h2 class="flex items-center gap-2 text-base font-semibold mb-3 tracking-wider">
						<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
						当前状态
					</h2>
					<div class="border border-[var(--primary)]/10 bg-[var(--primary)]/[0.04] rounded-lg p-4 mb-3 transition hover:border-[var(--primary)]/20">
						<div class="flex items-center gap-2 mb-1">
							<span class="w-[7px] h-[7px] rounded-full bg-[var(--primary)] flex-shrink-0 admin-pulse" />
							<span class="text-[0.7rem] font-medium tracking-wider uppercase text-[var(--primary)]/70">最新状态</span>
								<span class="ml-auto text-xs font-mono text-50">{formatTime(statusData?.current?.updatedAt ?? null)}</span>
						</div>
						<div class="text-lg tracking-wider pl-1">
							{#if statusData?.current?.text}
								{statusData.current.text}
							{:else}
								<span class="text-50 italic">（空）</span>
							{/if}
						</div>
					</div>
					<div class="flex gap-2 items-center">
						<input
							type="text"
							bind:value={newStatusText}
							placeholder="输入新的状态内容…"
							disabled={updateLoading}
							class="flex-1 min-w-0"
						/>
						<button onclick={handleUpdateCurrent} disabled={updateLoading || !newStatusText.trim()}
							class="flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium tracking-wider
								bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
								disabled:opacity-40 transition">
							{updateLoading ? "更新中…" : "更 新"}
						</button>
					</div>
					{#if updateError}
						<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2 mt-2">{updateError}</div>
					{/if}
				</div>

				<!-- ===== New Record ===== -->
				<div class="mb-6 pb-5 border-b border-dashed border-[var(--line-divider)]">
					<h2 class="flex items-center gap-2 text-base font-semibold mb-3 tracking-wider">
						<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
						新增记录
					</h2>
					<p class="text-xs text-50 ml-3 mb-3 tracking-wide">向历史添加一条记录，不改变当前状态</p>
					<div class="flex gap-2 items-center">
						<input
							type="text"
							bind:value={createText}
							placeholder="输入状态内容…"
							disabled={createLoading}
							class="flex-1 min-w-0"
						/>
						<button onclick={handleCreate} disabled={createLoading || !createText.trim()}
							class="flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium tracking-wider
								bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
								disabled:opacity-40 transition">
							{createLoading ? "创建中…" : "新 增"}
						</button>
					</div>
					{#if createError}
						<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2 mt-2">{createError}</div>
					{/if}
				</div>

				<!-- ===== History ===== -->
				<div>
					<h2 class="flex items-center gap-2 text-base font-semibold mb-3 tracking-wider">
						<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
						历史记录
						<span class="text-xs font-normal text-50 ml-1 px-2 py-0.5 rounded-full bg-[var(--primary)]/10">{statusData?.history?.length ?? 0}</span>
					</h2>
					<div class="flex flex-col gap-1">
						{#each statusData?.history ?? [] as entry, i}
							<div class="group flex items-start gap-2.5 p-3 border border-[var(--line-color)] rounded-lg transition
								hover:border-[var(--primary)]/20 hover:bg-[var(--primary)]/[0.03] hover:translate-x-0.5
								class:border-[var(--primary)]={editingId === entry.id}
								class:bg-[var(--primary)]/[0.05]={editingId === entry.id}
								onload-animation"
								style="animation-delay: {i * 0.04}s">
								<span class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full
									bg-[var(--primary)]/10 text-[var(--primary)]/80 font-mono font-semibold text-xs transition
									group-hover:bg-[var(--primary)]/20">{i + 1}</span>
								<div class="flex-1 min-w-0">
									{#if editingId === entry.id}
										<div class="flex flex-col gap-1.5">
											<input type="text" bind:value={editText} disabled={editLoading} class="text-sm" />
											<div class="flex gap-1.5">
												<button onclick={handleSaveEdit} disabled={editLoading || !editText.trim()}
													class="px-3 py-1 rounded-lg text-xs font-medium
														bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
														disabled:opacity-40 transition">
													{editLoading ? "保存…" : "保存"}
												</button>
												<button onclick={cancelEdit} class="btn-plain px-3 py-1 text-xs">取消</button>
											</div>
											{#if editError}
												<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-2 py-1">{editError}</div>
											{/if}
										</div>
									{:else}
										<div class="text-sm leading-relaxed tracking-wide break-words">{entry.text}</div>
										<div class="text-xs font-mono text-50 mt-0.5 opacity-80">{formatTime(entry.updatedAt)}</div>
									{/if}
								</div>
								{#if editingId !== entry.id}
									<div class="flex gap-0.5 flex-shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition">
										<button onclick={() => startEdit(entry)} title="编辑"
											class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
										</button>
										<button onclick={() => confirmDelete(entry)} title="删除"
											class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-red-500 hover:bg-red-500/10 transition">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if activeTab === "posts"}
				<!-- ===== Post List ===== -->
				<div transition:fade={{ duration: 150 }}>
					<div class="flex items-center justify-between mb-3">
						<h2 class="flex items-center gap-2 text-base font-semibold tracking-wider">
							<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
							文章列表
							<span class="text-xs font-normal text-50 ml-1 px-2 py-0.5 rounded-full bg-[var(--primary)]/10">{postList.length}</span>
						</h2>
						<button onclick={openNewPost}
							class="px-3 py-1.5 rounded-lg text-xs font-medium tracking-wider
								bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97] transition">
							+ 新建文章
						</button>
					</div>

					{#if postListLoading}
						<div class="py-8 flex items-center justify-center gap-3 text-50 text-sm">
							<span class="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
							加载中…
						</div>
					{:else if postList.length === 0}
						<div class="py-8 text-center text-50 text-sm">暂无文章</div>
					{:else}
						<div class="flex flex-col gap-1">
							{#each postList as post, i}
								<div class="group flex items-center gap-3 p-3 border border-[var(--line-color)] rounded-lg transition
									hover:border-[var(--primary)]/20 hover:bg-[var(--primary)]/[0.03] hover:translate-x-0.5"
									style="animation-delay: {i * 0.03}s">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<span class="text-sm font-medium tracking-wide truncate">{post.title}</span>
											{#if post.draft}
												<span class="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 font-medium flex-shrink-0">草稿</span>
											{/if}
										</div>
										<div class="flex items-center gap-2 text-xs text-50">
											<span class="font-mono">{post.slug}</span>
											<span class="opacity-50">|</span>
											<span>{formatDateShort(post.published)}</span>
											{#if post.category}
												<span class="opacity-50">|</span>
												<span>{post.category}</span>
											{/if}
										</div>
									</div>
									<div class="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
										<button onclick={() => openEditPost(post.slug)} title="编辑"
											class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
										</button>
										<button onclick={() => confirmDeletePost(post.slug, post.title)} title="删除"
											class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-red-500 hover:bg-red-500/10 transition">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
			{#if activeTab === "users"}
				<!-- ===== User Management ===== -->
				<div transition:fade={{ duration: 150 }}>
					<div class="flex items-center justify-between mb-3">
						<h2 class="flex items-center gap-2 text-base font-semibold tracking-wider">
							<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
							用户列表
							<span class="text-xs font-normal text-50 ml-1 px-2 py-0.5 rounded-full bg-[var(--primary)]/10">{userList.length}</span>
						</h2>
						<button onclick={openNewUser}
							class="px-3 py-1.5 rounded-lg text-xs font-medium tracking-wider
								bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97] transition">
							+ 新建用户
						</button>
					</div>

					{#if userListLoading}
						<div class="py-8 flex items-center justify-center gap-3 text-50 text-sm">
							<span class="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
							加载中…
						</div>
					{:else if userList.length === 0}
						<div class="py-8 text-center text-50 text-sm">暂无用户</div>
					{:else}
						<div class="flex flex-col gap-1">
							{#each userList as user, i}
								<div class="group flex items-center gap-3 p-3 border border-[var(--line-color)] rounded-lg transition
									hover:border-[var(--primary)]/20 hover:bg-[var(--primary)]/[0.03] hover:translate-x-0.5"
									style="animation-delay: {i * 0.03}s">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-0.5">
											<span class="text-sm font-medium tracking-wide">{user.displayName}</span>
											<span class="text-[0.6rem] px-1.5 py-0.5 rounded-full
												class:bg-[var(--primary)]/15 class:text-[var(--primary)]={user.group === 'admin'}
												class:bg-blue-500/15 class:text-blue-600 dark:text-blue-400={user.group === 'editor'}
												class:bg-neutral-500/15 class:text-neutral-600 dark:text-neutral-400={user.group === 'viewer'}
												font-medium flex-shrink-0">
												{user.group === 'admin' ? '管理员' : user.group === 'editor' ? '编辑' : '用户'}
											</span>
										</div>
										<div class="flex items-center gap-2 text-xs text-50">
											<span class="font-mono">@{user.username}</span>
											{#if user.bio}
												<span class="opacity-50">|</span>
												<span>{user.bio}</span>
											{/if}
										</div>
									</div>
									<div class="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
										<button onclick={() => openEditUser(user)} title="编辑"
											class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
										</button>
										{#if user.username !== 'CCA8798'}
											<button onclick={() => confirmDeleteUser(user.username)} title="删除"
												class="flex items-center justify-center w-7 h-7 rounded-lg text-50 hover:text-red-500 hover:bg-red-500/10 transition">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

		{/if}
	</div>
</div>

<!-- Delete Confirmation Modal (status) -->
{#if deletingEntry}
	<div class="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center" onclick={cancelDelete}>
		<div class="admin-card max-w-sm w-11/12 p-6 text-center shadow-2xl text-75" onclick={(e) => e.stopPropagation()}>
			<div class="text-red-500 opacity-70 mb-2">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
			</div>
			<h3 class="text-base font-semibold mb-2 tracking-wider text-75">确认删除</h3>
			<p class="text-sm text-50 mb-3 tracking-wide">确定要删除这条记录吗？</p>
			<div class="text-sm leading-relaxed px-3 py-2 mb-4 rounded-lg bg-[var(--card-bg)] border border-[var(--line-color)] break-words tracking-wide text-75">
				{deletingEntry.text}
			</div>
			<div class="flex gap-2 justify-center">
				<button onclick={cancelDelete} class="btn-plain px-4 py-2 text-sm">取消</button>
				<button onclick={handleDelete} disabled={deleteLoading}
					class="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:opacity-90 active:scale-[0.97] disabled:opacity-40 transition">
					{deleteLoading ? "删除中…" : "确认删除"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Post Editor Modal -->
{#if showPostEditor}
	<div class="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onclick={closePostEditor}>
		<div class="admin-card w-full max-w-2xl mx-4 p-6 shadow-2xl text-left text-75" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-5 pb-3 border-b border-dashed border-[var(--line-divider)]">
				<h3 class="flex items-center gap-2 text-base font-semibold tracking-wider">
					<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
					{postEditorMode === "create" ? "新建文章" : "编辑文章"}
				</h3>
				<button onclick={closePostEditor} class="text-50 hover:text-75 transition p-1">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
				</button>
			</div>

			<div class="flex flex-col gap-3">
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">Slug（URL 标识）</label>
					<input type="text" bind:value={postSlug} placeholder="my-post-slug"
						disabled={postEditorMode === "edit"}
						class="disabled:opacity-40" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">标题</label>
					<input type="text" bind:value={postTitle} placeholder="文章标题" />
				</div>
				<div class="flex gap-3">
					<div class="flex-1">
						<label class="text-xs text-50 tracking-wide mb-1 block">发布时间</label>
						<input type="datetime-local" bind:value={postPublished} />
					</div>
					<div class="flex items-end pb-2">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={postDraft}
								class="w-4 h-4 rounded border-[var(--line-color)] accent-[var(--primary)]" />
							<span class="text-xs text-50 tracking-wide">草稿</span>
						</label>
					</div>
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">标签（逗号分隔）</label>
					<input type="text" bind:value={postTags} placeholder="标签1, 标签2" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">分类</label>
					<input type="text" bind:value={postCategory} placeholder="分类名称" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">作者</label>
					<input type="text" bind:value={postAuthor} placeholder="文章作者" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">描述</label>
					<textarea bind:value={postDescription} placeholder="文章描述"
						class="w-full px-3 py-2 border border-[var(--line-color)] rounded-lg text-sm min-h-[4rem] resize-y
							focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_20%,transparent)]
							transition font-inherit tracking-wide"></textarea>
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">正文（Markdown）</label>
					<textarea bind:value={postBody} placeholder="在此编写文章内容…"
						class="w-full px-3 py-2 border border-[var(--line-color)] rounded-lg text-sm min-h-[12rem] resize-y font-mono
							focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_20%,transparent)]
							transition" rows="12"></textarea>
				</div>
				{#if postError}
					<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">{postError}</div>
				{/if}
			</div>

			<div class="flex gap-2 justify-end mt-5 pt-3 border-t border-dashed border-[var(--line-divider)]">
				<button onclick={closePostEditor} class="btn-plain px-4 py-2 text-sm">取消</button>
				<button onclick={handleSavePost} disabled={postSaving || !postSlug.trim() || !postTitle.trim()}
					class="px-5 py-2 rounded-lg text-sm font-medium tracking-wider
						bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
						disabled:opacity-40 transition">
					{postSaving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Post Delete Confirmation Modal -->
{#if deletingPostSlug}
	<div class="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center" onclick={cancelDeletePost}>
		<div class="admin-card max-w-sm w-11/12 p-6 text-center shadow-2xl text-75" onclick={(e) => e.stopPropagation()}>
			<div class="text-red-500 opacity-70 mb-2">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
			</div>
			<h3 class="text-base font-semibold mb-2 tracking-wider text-75">确认删除</h3>
			<p class="text-sm text-50 mb-3 tracking-wide">确定要删除文章「{deletingPostTitle}」吗？此操作不可撤销。</p>
			<div class="flex gap-2 justify-center">
				<button onclick={cancelDeletePost} class="btn-plain px-4 py-2 text-sm">取消</button>
				<button onclick={handleDeletePost} disabled={postDeleteLoading}
					class="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:opacity-90 active:scale-[0.97] disabled:opacity-40 transition">
					{postDeleteLoading ? "删除中…" : "确认删除"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- User Editor Modal -->
{#if showUserEditor}
	<div class="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-start justify-center pt-8 pb-8 overflow-y-auto" onclick={closeUserEditor}>
		<div class="admin-card w-full max-w-md mx-4 p-6 shadow-2xl text-left text-75" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between mb-5 pb-3 border-b border-dashed border-[var(--line-divider)]">
				<h3 class="flex items-center gap-2 text-base font-semibold tracking-wider">
					<span class="w-1 h-4 rounded-sm bg-[var(--primary)] flex-shrink-0"></span>
					{userEditMode === "create" ? "新建用户" : "编辑用户"}
				</h3>
				<button onclick={closeUserEditor} class="text-50 hover:text-75 transition p-1">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
				</button>
			</div>

			<div class="flex flex-col gap-3">
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">用户名</label>
					<input type="text" bind:value={userEditUsername} placeholder="username"
						disabled={userEditMode === "edit"}
						class="disabled:opacity-40" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">显示名称</label>
					<input type="text" bind:value={userEditDisplayName} placeholder="显示名称" />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">
						{userEditMode === "create" ? "密码" : "新密码（留空不修改）"}
					</label>
					<input type="password" bind:value={userEditPassword} placeholder={userEditMode === "create" ? "密码" : "留空不修改"} />
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">用户组</label>
					<select bind:value={userEditGroup}
						class="w-full px-3 py-2 border border-[var(--line-color)] rounded-lg text-sm
							focus:outline-none focus:border-[var(--primary)] transition font-inherit tracking-wide bg-[var(--page-bg)]">
						<option value="admin">管理员</option>
						<option value="editor">编辑</option>
						<option value="viewer">用户</option>
					</select>
				</div>
				<div>
					<label class="text-xs text-50 tracking-wide mb-1 block">简介</label>
					<input type="text" bind:value={userEditBio} placeholder="用户简介" />
				</div>
				{#if userError}
					<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">{userError}</div>
				{/if}
			</div>

			<div class="flex gap-2 justify-end mt-5 pt-3 border-t border-dashed border-[var(--line-divider)]">
				<button onclick={closeUserEditor} class="btn-plain px-4 py-2 text-sm">取消</button>
				<button onclick={handleSaveUser} disabled={userSaving || (userEditMode === "create" && (!userEditUsername.trim() || !userEditPassword.trim()))}
					class="px-5 py-2 rounded-lg text-sm font-medium tracking-wider
						bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
						disabled:opacity-40 transition">
					{userSaving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- User Delete Confirmation Modal -->
{#if deletingUsername}
	<div class="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center" onclick={cancelDeleteUser}>
		<div class="admin-card max-w-sm w-11/12 p-6 text-center shadow-2xl text-75" onclick={(e) => e.stopPropagation()}>
			<div class="text-red-500 opacity-70 mb-2">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
			</div>
			<h3 class="text-base font-semibold mb-2 tracking-wider text-75">确认删除</h3>
			<p class="text-sm text-50 mb-3 tracking-wide">确定要删除用户「{deletingUsername}」吗？</p>
			<div class="flex gap-2 justify-center">
				<button onclick={cancelDeleteUser} class="btn-plain px-4 py-2 text-sm">取消</button>
				<button onclick={handleDeleteUser} disabled={userDeleteLoading}
					class="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:opacity-90 active:scale-[0.97] disabled:opacity-40 transition">
					{userDeleteLoading ? "删除中…" : "确认删除"}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-card {
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: var(--radius-large);
		transition: all 0.15s ease;
	}
	input, textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--line-color);
		border-radius: 0.5rem;
		background: var(--page-bg);
		font-size: 0.875rem;
		box-sizing: border-box;
		font-family: inherit;
		letter-spacing: 0.5px;
		transition: all 0.15s ease;
		color: var(--deep-text);
	}
	input::placeholder, textarea::placeholder { color: var(--text-50, #999); opacity: 0.6; }
	input:focus, textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent), 0 0 12px color-mix(in srgb, var(--primary) 8%, transparent);
	}
	input:disabled, textarea:disabled { opacity: 0.5; }
	.btn-plain {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--text-50, #999);
		border: 1px solid transparent;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
		letter-spacing: 0.5px;
	}
	.btn-plain:hover { color: var(--deep-text); background: color-mix(in srgb, var(--primary) 6%, transparent); }
	.onload-animation { animation-delay: 0ms; }
	.admin-pulse {
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.3; transform: scale(0.6); }
	}
</style>
