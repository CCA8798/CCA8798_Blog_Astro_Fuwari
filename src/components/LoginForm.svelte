<script lang="ts">
import { onMount } from "svelte";

let username = $state("");
let password = $state("");
let error = $state("");
let loading = $state(false);
let success = $state(false);

onMount(() => {
	const saved = localStorage.getItem("admin_token");
	if (saved) {
		success = true;
	}
});

async function handleLogin() {
	loading = true;
	error = "";
	try {
		const res = await fetch("/api/admin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "login", username, password }),
		});
		const data = await res.json();
		if (res.ok) {
			localStorage.setItem("admin_token", data.token);
			if (data.user)
				localStorage.setItem("admin_user", JSON.stringify(data.user));
			success = true;
		} else {
			error = data.error || "登录失败";
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
		<span>登录成功</span>
		<a href="/admin" class="px-5 py-2 rounded-lg text-sm font-medium tracking-wider
			bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97] transition">
			进入后台
		</a>
	</div>
{:else}
	<div class="py-8 flex justify-center">
		<div class="w-full max-w-sm text-center">
			<div class="text-[var(--primary)] opacity-70 mb-3">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M2.1 13.1a.97.97 0 0 1 0-2.2 8.69 8.69 0 0 0 5.15-5.89.97.97 0 0 1 1.87 0 8.69 8.69 0 0 0 5.15 5.89.97.97 0 0 1 0 2.2 8.69 8.69 0 0 0-5.15 5.89.97.97 0 0 1-1.87 0 8.69 8.69 0 0 0-5.15-5.89Z"/></svg>
			</div>
			<h2 class="text-sm font-medium text-50 tracking-widest mb-6">用户登录</h2>
			<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
				<input
					type="text"
					bind:value={username}
					placeholder="用户名"
					disabled={loading}
					class="w-full text-center tracking-[2px] text-base px-4 py-3
						border border-[var(--line-color)] rounded-lg
						text-75 placeholder-neutral-400/60
						focus:outline-none focus:border-[var(--primary)]
						disabled:opacity-50 transition mb-3"
				/>
				<input
					type="password"
					bind:value={password}
					placeholder="密码"
					disabled={loading}
					class="w-full text-center tracking-[4px] text-base px-4 py-3
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
				<button type="submit" disabled={loading || !username || !password}
					class="w-full py-3 rounded-lg text-sm font-medium tracking-[4px]
						bg-[var(--primary)] text-white hover:opacity-90 active:scale-[0.97]
						disabled:opacity-40 transition">
					{loading ? "验证中…" : "登 录"}
				</button>
			</form>
			<div class="mt-5 text-xs text-50">
				还没有账号？
				<a href="/register" class="text-[var(--primary)] hover:underline">注册</a>
			</div>
		</div>
	</div>
{/if}
