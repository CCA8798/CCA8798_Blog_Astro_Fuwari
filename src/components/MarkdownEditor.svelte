<script>
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup, EditorView } from "@codemirror/view";
import type { MarkdownIt } from "markdown-it";
import { onDestroy, onMount } from "svelte";

interface Props {
	value: string;
	slug: string;
	onSave?: () => void;
}

let { value = "", slug, onSave }: Props = $props();
let editorView: EditorView | null = $state(null);
let previewHtml: string = $state("");
let isFullscreen: boolean = $state(false);
let hasDraft: boolean = $state(false);
let showDraftPrompt: boolean = $state(false);
let hiddenFileInput: HTMLInputElement | null = $state(null);

let md: MarkdownIt;
let sanitize: any;
let draftTimeout: NodeJS.Timeout;
let previewTimeout: NodeJS.Timeout;

onMount(async () => {
	const MarkdownIt = (await import("markdown-it")).default;
	const sanitizeHtml = (await import("sanitize-html")).default;
	sanitize = sanitizeHtml;
	md = new MarkdownIt({ html: true, linkify: true });

	const draft = localStorage.getItem(`draft:${slug}`);
	if (draft && draft !== value) {
		hasDraft = true;
	}

	const updateListener = EditorView.updateListener.of((update) => {
		if (update.docChanged) {
			value = update.state.doc.toString();
			updatePreview();
			saveDraft();
		}
	});

	editorView = new EditorView({
		state: EditorState.create({
			doc: value,
			extensions: [
				basicSetup,
				markdown(),
				EditorView.theme({
					"&": { fontSize: "0.875rem", fontFamily: "inherit" },
					".cm-content": { padding: "0.75rem" },
					".cm-editor": { height: "100%" },
				}),
				oneDark,
				updateListener,
			],
		}),
		parent: document.getElementById("editor-container")!,
	});

	updatePreview();
});

onDestroy(() => {
	editorView?.destroy();
	clearTimeout(draftTimeout);
	clearTimeout(previewTimeout);
});

$effect(() => {
	if (editorView && editorView.state.doc.toString() !== value) {
		editorView.dispatch({
			changes: { from: 0, to: editorView.state.doc.length, insert: value },
		});
	}
});

function updatePreview() {
	clearTimeout(previewTimeout);
	previewTimeout = setTimeout(() => {
		previewHtml = sanitize(md.render(value));
	}, 300);
}

function saveDraft() {
	clearTimeout(draftTimeout);
	draftTimeout = setTimeout(() => {
		localStorage.setItem(`draft:${slug}`, value);
		hasDraft = false;
	}, 1000);
}

function restoreDraft() {
	const draft = localStorage.getItem(`draft:${slug}`);
	if (draft) {
		value = draft;
		hasDraft = false;
		showDraftPrompt = false;
	}
}

function clearDraft() {
	localStorage.removeItem(`draft:${slug}`);
	hasDraft = false;
	showDraftPrompt = false;
}

function wrapText(before: string, after: string) {
	const view = editorView;
	if (!view) return;
	const { from, to } = view.state.selection.main;
	const selected = view.state.sliceDoc(from, to);
	view.dispatch({
		changes: { from, to, insert: before + selected + after },
		selection: { anchor: from + before.length + selected.length },
	});
}

function insertAtLineStart(prefix: string) {
	const view = editorView;
	if (!view) return;
	const { from } = view.state.selection.main;
	const line = view.state.doc.lineAt(from);
	view.dispatch({
		changes: { from: line.from, to: line.from, insert: prefix },
	});
}

function uploadImage() {
	if (hiddenFileInput) {
		hiddenFileInput.click();
	}
}

function handleFileSelect(e: Event) {
	const input = e.target;
	const file = input?.files?.[0];
	if (file) {
		processImageUpload(file);
	}
	input.value = "";
}

async function processImageUpload(file: File) {
	if (!file.type.startsWith("image/")) {
		alert("请选择图片文件");
		return;
	}
	if (file.size > 5 * 1024 * 1024) {
		alert("图片大小不能超过 5MB");
		return;
	}

	const reader = new FileReader();
	reader.onload = async () => {
		const base64 = reader.result as string;
		try {
			const res = await fetch("/api/admin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "postUploadImage",
					token: localStorage.getItem("admin_token"),
					slug,
					filename: file.name,
					data: base64,
				}),
			});
			const data = await res.json();
			if (res.ok && data.path) {
				insertAtCursor(`![](${data.path})`);
			} else {
				alert(data.error || "上传失败");
			}
		} catch (e) {
			alert("上传失败");
		}
	};
	reader.readAsDataURL(file);
}

function insertAtCursor(text: string) {
	const view = editorView;
	if (!view) return;
	const { from } = view.state.selection.main;
	view.dispatch({ changes: { from, to: from, insert: text } });
}

function toggleFullscreen() {
	isFullscreen = !isFullscreen;
}
</script>

{#if hasDraft}
<div class="absolute bottom-4 right-4 z-50">
	<button onclick={() => showDraftPrompt = true} class="px-4 py-2 bg-yellow-500 text-white rounded-lg shadow-lg hover:bg-yellow-600 transition">
		检测到未保存的草稿
	</button>
</div>
{/if}

{#if showDraftPrompt}
<div class="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center" onclick={() => showDraftPrompt = false}>
	<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm" onclick={(e) => e.stopPropagation()}>
		<p class="mb-4">检测到未保存的草稿，是否恢复？</p>
		<div class="flex gap-2 justify-end">
			<button onclick={clearDraft} class="px-4 py-2 rounded border border-[var(--line-color)] hover:bg-[var(--page-bg)] transition">丢弃</button>
			<button onclick={restoreDraft} class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">恢复</button>
		</div>
	</div>
</div>
{/if}

<div class:list={["markdown-editor", "flex flex-col border border-[var(--line-color)] rounded-lg bg-[var(--page-bg)]", "fixed inset-0 z-60 rounded-none": isFullscreen]}>
	<div class="flex items-center gap-1 p-2 border-b border-[var(--line-color)] bg-[var(--card-bg)]">
		<button onclick={() => wrapText("**", "**")} title="加粗" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">B</button>
		<button onclick={() => wrapText("*", "*")} title="斜体" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">I</button>
		<button onclick={() => insertAtLineStart("## ")} title="标题" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">H</button>
		<button onclick={() => wrapText("[", "](url)")} title="链接" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">🔗</button>
		<button onclick={uploadImage} title="上传图片" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">🖼️</button>
		<button onclick={() => wrapText("```", "```")} title="代码" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">{'<>'}</button>
		<button onclick={() => insertAtLineStart("> ")} title="引用" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">"</button>
		<button onclick={() => insertAtLineStart("- ")} title="列表" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">•</button>
		<button onclick={() => insertAtCursor("---\n")} title="分割线" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">—</button>
		<div class="flex-1"></div>
		<button onclick={toggleFullscreen} title="全屏" class="px-2 py-1 rounded hover:bg-[var(--primary)] hover:text-white transition">⛶</button>
	</div>

	<div class="flex-1 flex overflow-hidden">
		<div class="w-1/2 h-full overflow-auto">
			<div id="editor-container" class="h-full font-mono text-sm"></div>
		</div>
		<div class="w-1/2 h-full overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none">
			{@html previewHtml}
		</div>
	</div>

	<input type="file" accept="image/*" hidden bind:this={hiddenFileInput} onchange={handleFileSelect} />
</div>

<style>
	.markdown-editor {
		min-height: 30rem;
	}
	.markdown-editor button {
		transition: all 0.15s ease;
	}
</style>