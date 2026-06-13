<script lang="ts">
import { onMount } from "svelte";

let username = $state("");
let displayName = $state("");
let password = $state("");
let confirm = $state("");
let bio = $state("");
let error = $state("");
let loading = $state(false);
let success = $state(false);
let pageLoad = $state(0);

onMount(() => {
	pageLoad = Date.now();
});

async function handleRegister() {
	loading = true;
	error = "";
	try {
		const res = await fetch("/api/admin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "register",
				username: username.trim(),
				displayName: displayName.trim() || username.trim(),
				password,
				confirmPassword: confirm,
				bio: bio.trim(),
				pageLoad,
				honeypot: "",
			}),
		});
		const data = await res.json();
		if (res.ok) {
			localStorage.setItem("admin_token", data.token);
			if (data.user)
				localStorage.setItem("admin_user", JSON.stringify(data.user));
			success = true;
		} else {
			error = data.error || "注册失败";
		}
	} catch {
		error = "网络错误";
	}
	loading = false;
}
</script>

{#if success}
	<div class="py-12 flex flex-col items-center justify-center gap-4 text-50 text-sm tracking-wider">
		<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
		<span>注册成功</span>
		<a href="/admin" class="px-5 py-2 rounded-lg text-sm font-medium tracking-wider
			bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97] transition">
			进入后台
		</a>
	</div>
{:else}
	<div class="py-8 flex justify-center">
		<div class="w-full max-w-sm text-center">
			<div class="text-[var(--primary)] opacity-70 mb-3">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
			</div>
			<h2 class="text-sm font-medium text-50 tracking-widest mb-6">用户注册</h2>
			<form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
				<input
					type="text" autocomplete="off"
					bind:value={username}
					placeholder="用户名（2-20 位，字母数字下划线中文）"
					disabled={loading}
					class="w-full text-center tracking-[2px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-3"
				/>
				<input
					type="text" autocomplete="off"
					bind:value={displayName}
					placeholder="显示名称（选填）"
					disabled={loading}
					class="w-full text-center tracking-[2px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-3"
				/>
				<input
					type="password" autocomplete="new-password"
					bind:value={password}
					placeholder="密码（至少 6 位）"
					disabled={loading}
					class="w-full text-center tracking-[4px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-3"
				/>
				<input
					type="password" autocomplete="new-password"
					bind:value={confirm}
					placeholder="确认密码"
					disabled={loading}
					class="w-full text-center tracking-[4px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-3"
				/>
				<input
					type="text" autocomplete="off"
					bind:value={bio}
					placeholder="个人简介（选填）"
					disabled={loading}
					class="w-full text-center tracking-[2px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-4"
				/>
				{#if error}
					<div class="text-xs text-red-500 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2 mb-4">{error}</div>
{/if}

<style>
	input, textarea {
		background: var(--page-bg);
		color: var(--deep-text);
	}
</style>
				<button type="submit" disabled={loading || !username || !password || !confirm}
					class="w-full py-3 rounded-lg text-sm font-medium tracking-[4px]
						bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
						disabled:opacity-40 transition">
					{loading ? "注册中…" : "注 册"}
				</button>
			</form>
			<div class="mt-5 text-xs text-50">
				已有账号？
				<a href="/login" class="text-[var(--primary)] hover:underline">登录</a>
			</div>
		</div>
	</div>
{/if}
