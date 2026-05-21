import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

const STATUS_FILE = path.resolve("status.json");

export const GET: APIRoute = async ({ url }) => {
	const textParam = url.searchParams.get("text");

	// Update mode: /api/status?text=xxx&token=yyy
	if (textParam !== null) {
		const token = process.env.STATUS_TOKEN;
		if (token && url.searchParams.get("token") !== token) {
			return new Response(JSON.stringify({ error: "Invalid token" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const text = textParam.trim();
		const status = { text, updatedAt: new Date().toISOString() };

		try {
			fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
			return new Response(JSON.stringify({ success: true, status }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			console.error("写入 status.json 失败:", err);
			return new Response(JSON.stringify({ error: "Failed to save status" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	// Read mode: /api/status
	try {
		let status: object = { text: "", updatedAt: null };
		if (fs.existsSync(STATUS_FILE)) {
			status = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
		}
		return new Response(JSON.stringify(status), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		console.error("读取 status.json 失败:", err);
		return new Response(JSON.stringify({ error: "Failed to load status" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
