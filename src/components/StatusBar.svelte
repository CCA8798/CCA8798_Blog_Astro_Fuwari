<script lang="ts">
import { onMount } from "svelte";

let currentTime = $state("");
let weather: { temp: number; desc: string } | null = $state(null);
let status: { text: string } | null = $state(null);
let proverb = $state("");

onMount(() => {
	updateTime();
	const timer = setInterval(updateTime, 1000);

	fetchWeather();
	fetchStatus();
	fetchProverb();

	return () => clearInterval(timer);
});

function updateTime() {
	const now = new Date();
	const opts: Intl.DateTimeFormatOptions = {
		timeZone: "Asia/Shanghai",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	};
	currentTime = now.toLocaleTimeString("zh-CN", opts);
}

async function fetchWeather() {
	try {
		const res = await fetch(
			"https://api.open-meteo.com/v1/forecast?latitude=22.8&longitude=113.3&current=temperature_2m,weather_code&timezone=Asia/Shanghai",
		);
		if (res.ok) {
			const data = await res.json();
			weather = {
				temp: Math.round(data.current.temperature_2m),
				desc: getWeatherDesc(data.current.weather_code),
			};
		}
	} catch {
		// ignore
	}
}

function getWeatherDesc(code: number): string {
	const map: Record<number, string> = {
		0: "晴",
		1: "少云",
		2: "多云",
		3: "阴",
		45: "雾",
		48: "雾凇",
		51: "小毛毛雨",
		53: "毛毛雨",
		55: "大毛毛雨",
		56: "冻毛毛雨",
		57: "大冻毛毛雨",
		61: "小雨",
		63: "中雨",
		65: "大雨",
		66: "冻雨",
		67: "大冻雨",
		71: "小雪",
		73: "中雪",
		75: "大雪",
		77: "雪粒",
		80: "小阵雨",
		81: "中阵雨",
		82: "大阵雨",
		85: "小阵雪",
		86: "大阵雪",
		95: "雷暴",
		96: "雷暴+冰雹",
		99: "强雷暴+冰雹",
	};
	return map[code] ?? "";
}

async function fetchStatus() {
	try {
		const res = await fetch("/api/status");
		if (res.ok) {
			const data = await res.json();
			if (data.text) status = data;
		}
	} catch {
		// ignore
	}
}

async function fetchProverb() {
	try {
		const res = await fetch("https://v1.hitokoto.cn/");
		if (res.ok) {
			const data = await res.json();
			proverb = data.hitokoto;
		}
	} catch {
		// ignore
	}
}
</script>

<div class="card-base p-3" id="status-bar">
	<div class="flex items-center justify-center gap-x-4 gap-y-1 text-sm text-neutral-400 flex-wrap">
		<span class="flex items-center gap-1.5 whitespace-nowrap">
			<span class="inline-block w-2 h-2 rounded-full bg-[var(--primary)] status-dot"></span>
			<span>北京时间 {currentTime}</span>
		</span>

		{#if weather}
			<span class="flex items-center gap-1.5 whitespace-nowrap">
				<span class="inline-block w-2 h-2 rounded-full bg-[var(--primary)] status-dot"></span>
				<span>顺德天气：{weather.temp}°C {weather.desc}</span>
			</span>
		{/if}

		{#if status?.text}
			<span class="flex items-center gap-1.5 whitespace-nowrap">
				<span class="inline-block w-2 h-2 rounded-full bg-[var(--primary)] status-dot"></span>
				<span>站长状态：{status.text}</span>
			</span>
		{/if}

		{#if proverb}
			<span class="flex items-center gap-1.5 whitespace-nowrap max-w-[40vw] truncate" title={proverb}>
				<span class="inline-block w-2 h-2 rounded-full bg-[var(--primary)] status-dot"></span>
				<span>每日谏言：{proverb}</span>
			</span>
		{/if}
	</div>
</div>

<style>
	.status-dot {
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
</style>
