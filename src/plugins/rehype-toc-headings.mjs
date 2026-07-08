import { visit } from "unist-util-visit";

/**
 * Rehype plugin that extracts all heading elements (h1-h6) from the rendered
 * HTML tree, including those from MDX JSX <h2> tags that Astro's built-in
 * heading extraction misses.
 */
export function rehypeTocHeadings() {
	return (tree, file) => {
		const headings = [];

		visit(tree, "element", (node) => {
			if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
				const depth = Number.parseInt(node.tagName[1], 10);
				const id = node.properties?.id;
				const text = extractText(node);
				if (id && text) {
					headings.push({ depth, slug: id, text });
				}
			}
		});

		file.data.astro = file.data.astro ?? {};
		file.data.astro.frontmatter = file.data.astro.frontmatter ?? {};
		file.data.astro.frontmatter.tocHeadings = headings;
	};
}

function extractText(node) {
	let text = "";
	if (node.type === "text") {
		return node.value;
	}
	if (node.children) {
		for (const child of node.children) {
			text += extractText(child);
		}
	}
	return text.trim();
}
