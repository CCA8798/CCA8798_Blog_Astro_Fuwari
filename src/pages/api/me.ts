import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { APIRoute } from "astro";

// Waline 共享运行时（与 server.cjs / astro dev 中间件共用）
const require = createRequire(import.meta.url);
const waline = require("../../../waline-runtime.cjs") as {
	mintWalineToken: (
		username: string,
		displayName: string,
		group: string,
	) => string;
};

const SESSION_FILE = path.resolve("admin-session.json");
const USERS_FILE = path.resolve("users.json");

function readJSON<T>(file: string, fallback: T): T {
	try {
		if (fs.existsSync(file)) {
			return JSON.parse(fs.readFileSync(file, "utf-8"));
		}
	} catch {
		/* ignore */
	}
	return fallback;
}

function writeJSON(file: string, data: unknown): void {
	fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return new Response(JSON.stringify({ loggedIn: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const token = authHeader.slice(7);
	const sessions = readJSON<
		Record<string, { ip: string; username: string; createdAt: number }>
	>(SESSION_FILE, {});
	const session = sessions[token];
	if (!session) {
		return new Response(JSON.stringify({ loggedIn: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (Date.now() - session.createdAt > 86400000) {
		delete sessions[token];
		writeJSON(SESSION_FILE, sessions);
		return new Response(JSON.stringify({ loggedIn: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const users = readJSON<{ users: Array<Record<string, unknown>> } | null>(
		USERS_FILE,
		null,
	);
	const user = users?.users?.find((u) => u.username === session.username);
	if (!user) {
		return new Response(JSON.stringify({ loggedIn: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	const username = user.username as string;
	const displayName = (user.displayName as string) || (user.username as string);
	const group = (user.group as string) || "viewer";

	return new Response(
		JSON.stringify({
			loggedIn: true,
			username,
			displayName,
			group,
			bio: (user.bio as string) || "",
			walineToken: waline.mintWalineToken(username, displayName, group),
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
