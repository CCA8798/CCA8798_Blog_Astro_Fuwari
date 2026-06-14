<script lang="ts">
import { onMount } from "svelte";

interface GalleryImage {
	src: string | { src: string };
	alt?: string;
	caption?: string;
}

interface Props {
	images?: GalleryImage[];
}

let { images = [] }: Props = $props();

let currentIndex = $state<number | null>(null);
let lightboxRoot: HTMLDivElement;

function resolveSrc(img: GalleryImage): string {
	const s = img.src;
	return typeof s === "string" ? s : s.src;
}

function open(idx: number) {
	currentIndex = idx;
}

function close() {
	currentIndex = null;
}

function next() {
	if (currentIndex != null && currentIndex < images.length - 1) {
		currentIndex++;
	}
}

function prev() {
	if (currentIndex != null && currentIndex > 0) {
		currentIndex--;
	}
}

function onKeydown(e: KeyboardEvent) {
	if (currentIndex == null) return;
	if (e.key === "Escape") {
		close();
		return;
	}
	if (e.key === "ArrowRight") {
		next();
		return;
	}
	if (e.key === "ArrowLeft") {
		prev();
	}
}

onMount(() => {
	if (lightboxRoot) document.body.appendChild(lightboxRoot);
	document.addEventListener("keydown", onKeydown);
	return () => {
		if (lightboxRoot?.parentNode)
			lightboxRoot.parentNode.removeChild(lightboxRoot);
		document.removeEventListener("keydown", onKeydown);
	};
});
</script>

{#if images.length > 0}
	<div class="not-prose" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem;">
		{#each images as img, i}
			<button
				onclick={() => open(i)}
				class="group relative overflow-hidden rounded-xl cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
				aria-label={img.alt || `Image ${i + 1}`}
			>
				<img
					src={resolveSrc(img)}
					alt={img.alt || ""}
					loading="lazy"
					class="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
				/>
			</button>
		{/each}
	</div>
{/if}

<div
	bind:this={lightboxRoot}
	class="ig-backdrop fixed inset-0 z-[9999] items-center justify-center bg-black/80"
	style="display: {currentIndex != null ? 'flex' : 'none'}"
	onclick={close}
	role="dialog"
	aria-modal="true"
	aria-label="Image gallery"
>
	{#if currentIndex != null}
		<button
			onclick={close}
			class="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 hover:text-white"
			aria-label="Close lightbox"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>

		{#if currentIndex > 0}
			<button
				onclick={(e) => { e.stopPropagation(); prev(); }}
				class="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 hover:text-white"
				aria-label="Previous image"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
		{/if}

		{#if currentIndex < images.length - 1}
			<button
				onclick={(e) => { e.stopPropagation(); next(); }}
				class="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 transition-colors hover:bg-black/70 hover:text-white"
				aria-label="Next image"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
			</button>
		{/if}

		<div onclick={(e) => e.stopPropagation()} class="flex max-w-[90vw] flex-col items-center max-h-[90vh]">
			<img
				src={resolveSrc(images[currentIndex])}
				alt={images[currentIndex].alt || ""}
				class="h-auto w-auto max-h-[75vh] max-w-full rounded-lg object-contain shadow-lg"
			/>
			<div class="mt-3 flex flex-col items-center gap-1">
				{#if images[currentIndex].caption}
					<p class="px-4 text-center text-sm text-white/70">{images[currentIndex].caption}</p>
				{/if}
				<span class="text-xs text-white/50">{currentIndex + 1} / {images.length}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.ig-backdrop {
		animation: ig-fade-in 0.2s ease-out;
	}

	@keyframes ig-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
