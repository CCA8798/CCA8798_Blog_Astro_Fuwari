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
				return;
			}

			// Custom bordered components (e.g. <CustomBorder1 title="...">):
			// the inner <h3> is generated at component-render time, so it is not
			// visible as a heading while processing the MDX tree. Instead, surface
			// the component's `title` attribute as a heading entry (depth 3, matching
			// the <h3> rendered by the component), with slug equal to the raw title
			// so TOC anchors resolve to the real element id (`id={title}`).
			const isMdxJsx =
				node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
			if (isMdxJsx && node.name && /^CustomBorder/i.test(node.name) && Array.isArray(node.attributes)) {
				const titleAttr = node.attributes.find(
					(a) => a.type === "mdxJsxAttribute" && a.name === "title",
				);
				const title =
					typeof titleAttr?.value === "string" ? titleAttr.value : undefined;
				if (title) {
					headings.push({ depth: 3, slug: title, text: title });
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
