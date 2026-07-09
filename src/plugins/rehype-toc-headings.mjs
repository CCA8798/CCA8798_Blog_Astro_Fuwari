import { visit } from "unist-util-visit";

/**
 * Rehype plugin that extracts all heading elements (h1-h6) from the rendered
 * HTML tree, including those from MDX JSX <h2> tags that Astro's built-in
 * heading extraction misses.
 *
 * Handles both:
 * - Standard hast "element" nodes (e.g. from .md files)
 * - MDX JSX nodes ("mdxJsxFlowElement" / "mdxJsxTextElement", e.g. from .mdx files)
 */
export function rehypeTocHeadings() {
	return (tree, file) => {
		const headings = [];

		visit(tree, (node) => {
			// Regular HTML element: node.tagName (e.g. "h2")
			// MDX JSX element: node.name (e.g. "h2" from <h2>)
			const tagName = node.tagName || node.name;
			if (tagName && /^h[1-6]$/i.test(tagName)) {
				const depth = Number.parseInt(tagName[1], 10);
				// Regular elements store id in properties; MDX JSX uses attributes array
				let id = node.properties?.id;
				if (!id && Array.isArray(node.attributes)) {
					const idAttr = node.attributes.find(
						(a) => a.type === "mdxJsxAttribute" && a.name === "id",
					);
					id = idAttr?.value;
				}
				const text = extractText(node);
				if (text) {
					// If no id found, auto-generate from text (for JSX headings without explicit id)
					const slug =
						id ||
						text
							.toLowerCase()
							.replace(
								/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff\uf900-\ufaff\- ]/g,
								"",
							)
							.replace(/\s+/g, "-")
							.replace(/-+/g, "-")
							.replace(/^-|-$/g, "");
					headings.push({ depth, slug, text });
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
