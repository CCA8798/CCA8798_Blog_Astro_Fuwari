import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

const STATUS_FILE = path.resolve("status.json");

export const GET: APIRoute = async () => {
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
