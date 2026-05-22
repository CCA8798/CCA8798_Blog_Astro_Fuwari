<script lang="ts">
import { onMount } from "svelte";

interface HistoryEntry {
	id: string;
	text: string;
	updatedAt: string;
}

interface GroupedDay {
	date: string;
	entries: HistoryEntry[];
}

let history = $state<HistoryEntry[]>([]);
let grouped = $state<GroupedDay[]>([]);
let loading = $state(true);

onMount(async () => {
	try {
		const res = await fetch("/api/status?history");
		if (res.ok) {
			history = await res.json();
			grouped = groupByDay(history);
		}
	} catch {
		// ignore
	} finally {
		loading = false;
	}
});

function groupByDay(entries: HistoryEntry[]): GroupedDay[] {
	const map = new Map<string, HistoryEntry[]>();
	for (const e of entries) {
		const day = formatDate(e.updatedAt).dateFull;
		if (!map.has(day)) map.set(day, []);
		map.get(day)!.push(e);
	}
	return Array.from(map.entries()).map(([date, entries]) => ({
		date,
		entries,
	}));
}

function formatDate(iso: string) {
	const d = new Date(iso);
	const dateFull = d.toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
		weekday: "short",
	});
	const dateShort = d.toLocaleDateString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
	});
	const time = d.toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	return { dateFull, dateShort, time };
}

function timeAgo(iso: string): string {
	const now = Date.now();
	const then = new Date(iso).getTime();
	const diff = now - then;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "刚刚";
	if (mins < 60) return `${mins} 分钟前`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} 天前`;
	return `${Math.floor(days / 30)} 个月前`;
}
</script>

<div class="timeline-root">
	{#if loading}
		<div class="status-text">加载中...</div>
	{:else if history.length === 0}
		<div class="status-text">暂无更新记录</div>
	{:else}
		<div class="timeline-track"></div>
		{#each grouped as day, di}
			<div class="day-group" style="animation-delay: {di * 0.1}s">
				<div class="day-header">{day.date}</div>
				{#each day.entries as entry, ei}
					{@const idx = di * 999 + ei}
					<div class="tl-item" style="animation-delay: {idx * 0.05}s">
						<div class="tl-dot"></div>
						<div class="tl-body">
							<div class="tl-meta">
								<span class="tl-time">{formatDate(entry.updatedAt).time}</span>
								<span class="tl-ago">{timeAgo(entry.updatedAt)}</span>
							</div>
							<div class="tl-text">{entry.text}</div>
						</div>
					</div>
				{/each}
			</div>
		{/each}
	{/if}
</div>

<style>
	.timeline-root {
		position: relative;
		padding: 0.25rem 0;
	}

	.status-text {
		text-align: center;
		padding: 2rem 0;
		color: var(--text-50, #999);
		font-size: 1rem;
	}

	.timeline-track {
		position: absolute;
		left: 1rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: linear-gradient(180deg, transparent, var(--primary) 4%, var(--primary) 96%, transparent);
		border-radius: 1px;
		opacity: 0.4;
	}

	.day-group {
		position: relative;
		margin-bottom: 0.75rem;
		animation: fadeSlideIn 0.4s ease-out both;
	}

	.day-header {
		position: relative;
		margin-left: 3rem;
		margin-bottom: 0.4rem;
		padding: 0.15rem 0.65rem;
		display: inline-block;
		border-radius: 999px;
		background: var(--primary);
		color: #fff;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.5px;
		box-shadow: 0 0 6px color-mix(in srgb, var(--primary) 25%, transparent);
	}

	.tl-item {
		position: relative;
		display: flex;
		align-items: flex-start;
		margin-bottom: 0.4rem;
		padding-left: 3rem;
		animation: fadeSlideIn 0.3s ease-out both;
	}

	.tl-dot {
		position: absolute;
		left: calc(1rem + 7px);
		top: 0.4rem;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--primary);
		z-index: 2;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
		animation: dotGlow 2s ease-in-out infinite;
	}

	.tl-body {
		flex: 1;
		padding: 0.45rem 0.65rem;
		border-radius: var(--radius-large);
		background: var(--card-bg);
		border: 1px solid color-mix(in srgb, var(--primary) 8%, var(--line-color));
		transition: all 0.2s ease;
		position: relative;
		overflow: hidden;
	}

	.tl-body::after {
		content: "";
		position: absolute;
		right: 0;
		top: 0.4rem;
		bottom: 0.4rem;
		width: 3px;
		border-radius: 2px;
		background: var(--primary);
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}

	.tl-body:hover::after {
		opacity: 0.6;
	}

	.tl-body:hover {
		border-color: var(--primary);
		transform: translateX(2px);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent),
			0 0 10px color-mix(in srgb, var(--primary) 8%, transparent);
	}

	.tl-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.1rem;
	}

	.tl-time {
		font-size: 0.6rem;
		color: color-mix(in srgb, var(--primary) 55%, #999);
		font-family: "JetBrains Mono Variable", monospace;
		letter-spacing: 0.3px;
	}

	.tl-ago {
		font-size: 0.55rem;
		color: color-mix(in srgb, var(--primary) 35%, #bbb);
		font-family: "JetBrains Mono Variable", monospace;
	}

	.tl-text {
		font-size: 1.05rem;
		color: oklch(0.3 0.02 var(--hue));
		line-height: 1.5;
		position: relative;
		z-index: 1;
	}
	:global(.dark) .tl-text {
		color: oklch(0.85 0.02 var(--hue));
	}

	@keyframes fadeSlideIn {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes dotGlow {
		0%, 100% {
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent),
			            0 0 4px color-mix(in srgb, var(--primary) 25%, transparent);
		}
		50% {
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 30%, transparent),
			            0 0 8px var(--primary),
			            0 0 12px color-mix(in srgb, var(--primary) 20%, transparent);
		}
	}

	@media (min-width: 768px) {
		.timeline-root {
			padding: 0.25rem 0.25rem 0.75rem;
		}
		.timeline-track {
			left: 1.25rem;
		}
		.tl-item {
			padding-left: 3.5rem;
		}
		.tl-dot {
			left: calc(1.25rem + 11px);
			width: 10px;
			height: 10px;
		}
		.day-header {
			margin-left: 3.5rem;
		}
		.tl-body {
			padding: 0.5rem 0.75rem;
		}
		.tl-time {
			font-size: 0.65rem;
		}
		.tl-text {
			font-size: 1.1rem;
		}
	}
</style>
