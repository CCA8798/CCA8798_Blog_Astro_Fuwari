import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

const STATUS_FILE = path.resolve("status.json");
const MAX_HISTORY = 200;

interface StatusEntry {
	id: string;
	text: string;
	updatedAt: string | null;
}

interface StatusData {
	current: StatusEntry;
	history: StatusEntry[];
}

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readStatus(): StatusData {
	try {
		if (fs.existsSync(STATUS_FILE)) {
			const raw = fs.readFileSync(STATUS_FILE, "utf-8");
			const data = JSON.parse(raw);
			if (data.current !== undefined) {
				// Ensure entries have IDs (migrate legacy data)
				if (data.current.id === undefined) data.current.id = generateId();
				for (let i = 0; i < (data.history ?? []).length; i++) {
					if (data.history[i].id === undefined)
						data.history[i].id = generateId();
				}
				return data as StatusData;
			}
			const id = generateId();
			return {
				current: {
					id,
					text: data.text ?? "",
					updatedAt: data.updatedAt ?? null,
				},
				history: data.history ?? [],
			};
		}
	} catch {
		// ignore
	}
	const id = generateId();
	return { current: { id, text: "", updatedAt: null }, history: [] };
}

function writeStatus(data: StatusData): void {
	fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
	const textParam = url.searchParams.get("text");

	// Update mode: /api/status?text=xxx&token=yyy
	if (textParam !== null) {
		const token =
			process.env.STATUS_TOKEN || (import.meta.env.DEV ? "mtf" : undefined);
		if (token && url.searchParams.get("token") !== token) {
			return new Response(JSON.stringify({ error: "Invalid token" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const text = textParam.trim();
		const entry: StatusEntry = {
			id: generateId(),
			text,
			updatedAt: new Date().toISOString(),
		};

		try {
			const data = readStatus();
			data.current = entry;
			data.history.unshift(entry);
			if (data.history.length > MAX_HISTORY) {
				data.history = data.history.slice(0, MAX_HISTORY);
			}
			writeStatus(data);
			return new Response(JSON.stringify({ success: true, status: entry }), {
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

	// History-only mode: /api/status?history
	if (url.searchParams.has("history")) {
		try {
			const data = readStatus();
			return new Response(JSON.stringify(data.history), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			console.error("读取历史失败:", err);
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	// Read mode: /api/status → returns { text, updatedAt } (backward compat)
	try {
		const data = readStatus();
		return new Response(JSON.stringify(data.current), {
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
