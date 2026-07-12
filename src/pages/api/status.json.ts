import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

const LIST_FILE = path.resolve("list.json");

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		if (!fs.existsSync(LIST_FILE)) {
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		const raw = fs.readFileSync(LIST_FILE, "utf-8");
		const data = JSON.parse(raw);
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		console.error("读取 list.json 失败:", err);
		return new Response(JSON.stringify({ error: "Failed to load data" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
