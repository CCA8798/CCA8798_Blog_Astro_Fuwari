import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

const STATUS_FILE = path.resolve("status.json");
const RATE_LIMIT_FILE = path.resolve("rate-limit.json");
const SESSION_FILE = path.resolve("admin-session.json");
const USERS_FILE = path.resolve("users.json");
const MAX_HISTORY = 200;
const MAX_ATTEMPTS = 3;
const RATE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTER_MAX_PER_IP = 3;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REGISTER_MIN_TIME_MS = 3000; // 3 seconds
const REGISTER_RATE_FILE = path.resolve("register-rate.json");

// --- User groups ---
const GROUPS = { ADMIN: "admin", EDITOR: "editor", VIEWER: "viewer" } as const;
const GROUP_HIERARCHY: Record<string, number> = {
	admin: 3,
	editor: 2,
	viewer: 1,
};

// Password hashing (scrypt)
function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString("hex");
	const keylen = 64;
	const derivedKey = crypto.scryptSync(password, salt, keylen, {
		N: 16384,
		r: 8,
		p: 1,
		maxmem: 256 * 1024 * 1024,
	});
	return salt + ":" + derivedKey.toString("hex");
}

function verifyPassword(password: string, stored: string): boolean {
	const [salt, key] = stored.split(":");
	const keylen = 64;
	const derivedKey = crypto.scryptSync(password, salt, keylen, {
		N: 16384,
		r: 8,
		p: 1,
		maxmem: 256 * 1024 * 1024,
	});
	return key === derivedKey.toString("hex");
}

function loadAdminPasswords(): string[] | null {
	const envPw = process.env.ADMIN_PASSWORD;
	if (envPw)
		return envPw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	try {
		const configPath = path.resolve("admin-config.json");
		if (fs.existsSync(configPath)) {
			const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
			if (Array.isArray(cfg.passwords) && cfg.passwords.length > 0)
				return cfg.passwords.map(String);
			if (cfg.password) return [cfg.password];
		}
	} catch {
		/* ignore */
	}
	return null;
}
const POSTS_DIR = path.resolve("src/content/posts");

interface PostInfo {
	slug: string;
	title: string;
	published: string;
	draft: boolean;
	tags: string[];
	category: string;
	description: string;
	author: string;
}

interface PostFull extends PostInfo {
	body: string;
}

function parseFrontmatter(content: string): {
	data: Record<string, unknown>;
	body: string;
} {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: content };
	const yaml = match[1];
	const body = match[2];
	const data: Record<string, unknown> = {};
	for (const line of yaml.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colonIdx = trimmed.indexOf(":");
		if (colonIdx === -1) continue;
		const key = trimmed.slice(0, colonIdx).trim();
		const raw = trimmed.slice(colonIdx + 1).trim();
		if (!raw) {
			data[key] = "";
			continue;
		}
		if (raw === "true") data[key] = true;
		else if (raw === "false") data[key] = false;
		else if (/^[-\d]+(?:\.[\d]+)?$/.test(raw)) data[key] = Number(raw);
		else if (raw.startsWith("[") && raw.endsWith("]")) {
			try {
				data[key] = JSON.parse(raw);
			} catch {
				data[key] = raw;
			}
		} else if (
			(raw.startsWith('"') && raw.endsWith('"')) ||
			(raw.startsWith("'") && raw.endsWith("'"))
		) {
			data[key] = raw.slice(1, -1);
		} else {
			data[key] = raw;
		}
	}
	return { data, body };
}

function buildFrontmatter(data: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined || value === null || value === "") continue;
		if (Array.isArray(value)) {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		} else if (typeof value === "boolean") {
			lines.push(`${key}: ${value}`);
		} else if (typeof value === "number") {
			lines.push(`${key}: ${value}`);
		} else {
			const s = String(value);
			if (/[^\w\-/:\s.]/.test(s) || s.includes("\n")) {
				lines.push(`${key}: "${s.replace(/"/g, '\\"')}"`);
			} else {
				lines.push(`${key}: ${s}`);
			}
		}
	}
	lines.push("---");
	return lines.join("\n");
}

function findPostFile(slug: string): string | null {
	const dir = path.join(POSTS_DIR, slug);
	if (!fs.existsSync(dir)) return null;
	const md = path.join(dir, "index.md");
	if (fs.existsSync(md)) return md;
	const mdx = path.join(dir, "index.mdx");
	if (fs.existsSync(mdx)) return mdx;
	return null;
}

function readPostList(): PostInfo[] {
	const result: PostInfo[] = [];
	try {
		const dirs = fs.readdirSync(POSTS_DIR, { withFileTypes: true });
		for (const dir of dirs) {
			if (!dir.isDirectory()) continue;
			const filePath = findPostFile(dir.name);
			if (!filePath) continue;
			const content = fs.readFileSync(filePath, "utf-8");
			const { data } = parseFrontmatter(content);
			result.push({
				slug: dir.name,
				title: (data.title as string) || dir.name,
				published: (data.published as string) || "",
				draft: (data.draft as boolean) || false,
				tags: (data.tags as string[]) || [],
				category: (data.category as string) || "",
				description: (data.description as string) || "",
				author: (data.author as string) || "",
			});
		}
	} catch {
		/* ignore */
	}
	result.sort((a, b) => {
		if (!a.published) return 1;
		if (!b.published) return -1;
		return new Date(b.published).getTime() - new Date(a.published).getTime();
	});
	return result;
}

function readPost(slug: string): PostFull | null {
	const filePath = findPostFile(slug);
	if (!filePath) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const { data, body } = parseFrontmatter(content);
	return {
		slug,
		title: (data.title as string) || slug,
		published: (data.published as string) || "",
		draft: (data.draft as boolean) || false,
		tags: (data.tags as string[]) || [],
		category: (data.category as string) || "",
		description: (data.description as string) || "",
		author: (data.author as string) || "",
		body,
	};
}

interface StatusEntry {
	id: string;
	text: string;
	updatedAt: string | null;
}

interface StatusData {
	current: StatusEntry;
	history: StatusEntry[];
}

interface RateData {
	[ip: string]: { count: number; firstAttempt: number };
}

interface SessionData {
	[token: string]: { ip: string; username: string; createdAt: number };
}

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

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readStatus(): StatusData {
	try {
		if (fs.existsSync(STATUS_FILE)) {
			const raw = fs.readFileSync(STATUS_FILE, "utf-8");
			const data = JSON.parse(raw);
			if (data.current !== undefined) {
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
		/* ignore */
	}
	const id = generateId();
	return { current: { id, text: "", updatedAt: null }, history: [] };
}

function writeStatus(data: StatusData): void {
	writeJSON(STATUS_FILE, data);
}

function checkRateLimit(ip: string): { allowed: boolean; remaining?: number } {
	const rates = readJSON<RateData>(RATE_LIMIT_FILE, {});
	const now = Date.now();

	if (rates[ip]) {
		// If outside window, reset
		if (now - rates[ip].firstAttempt > RATE_WINDOW_MS) {
			delete rates[ip];
			writeJSON(RATE_LIMIT_FILE, rates);
			return { allowed: true };
		}
		if (rates[ip].count >= MAX_ATTEMPTS) {
			const remaining = Math.ceil(
				(rates[ip].firstAttempt + RATE_WINDOW_MS - now) / 60000,
			);
			return { allowed: false, remaining };
		}
	}
	return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
	const rates = readJSON<RateData>(RATE_LIMIT_FILE, {});
	const now = Date.now();

	if (!rates[ip] || now - rates[ip].firstAttempt > RATE_WINDOW_MS) {
		rates[ip] = { count: 1, firstAttempt: now };
	} else {
		rates[ip].count++;
	}
	writeJSON(RATE_LIMIT_FILE, rates);
}

function clearRateLimit(ip: string): void {
	const rates = readJSON<RateData>(RATE_LIMIT_FILE, {});
	delete rates[ip];
	writeJSON(RATE_LIMIT_FILE, rates);
}

// Registration rate limiting
function checkRegisterRate(ip: string): {
	allowed: boolean;
	remaining: number;
} {
	const now = Date.now();
	const rates = readJSON<
		Record<string, { count: number; firstAttempt: number }>
	>(REGISTER_RATE_FILE, {});
	const entry = rates[ip];
	if (!entry || now - entry.firstAttempt > REGISTER_WINDOW_MS) {
		rates[ip] = { count: 0, firstAttempt: now };
		writeJSON(REGISTER_RATE_FILE, rates);
		return { allowed: true, remaining: REGISTER_MAX_PER_IP };
	}
	if (entry.count >= REGISTER_MAX_PER_IP) {
		const wait = Math.ceil(
			(entry.firstAttempt + REGISTER_WINDOW_MS - now) / 60000,
		);
		return { allowed: false, remaining: wait };
	}
	return { allowed: true, remaining: REGISTER_MAX_PER_IP - entry.count };
}

function recordRegisterAttempt(ip: string): void {
	const now = Date.now();
	const rates = readJSON<
		Record<string, { count: number; firstAttempt: number }>
	>(REGISTER_RATE_FILE, {});
	if (!rates[ip] || now - rates[ip].firstAttempt > REGISTER_WINDOW_MS) {
		rates[ip] = { count: 1, firstAttempt: now };
	} else {
		rates[ip].count++;
	}
	writeJSON(REGISTER_RATE_FILE, rates);
}

function createSession(ip: string, username: string): string {
	const token = crypto.randomUUID();
	const sessions = readJSON<SessionData>(SESSION_FILE, {});
	sessions[token] = { ip, username, createdAt: Date.now() };
	writeJSON(SESSION_FILE, sessions);
	return token;
}

function validateSession(
	token: string,
): { ip: string; username: string; createdAt: number } | null {
	const sessions = readJSON<SessionData>(SESSION_FILE, {});
	const session = sessions[token];
	if (!session) return null;
	if (Date.now() - session.createdAt > SESSION_TTL_MS) {
		delete sessions[token];
		writeJSON(SESSION_FILE, sessions);
		return null;
	}
	return session;
}

function deleteSession(token: string): void {
	const sessions = readJSON<SessionData>(SESSION_FILE, {});
	delete sessions[token];
	writeJSON(SESSION_FILE, sessions);
}

function cleanupSessions(): void {
	const sessions = readJSON<SessionData>(SESSION_FILE, {});
	const now = Date.now();
	let changed = false;
	for (const [token, data] of Object.entries(sessions)) {
		if (now - data.createdAt > SESSION_TTL_MS) {
			delete sessions[token];
			changed = true;
		}
	}
	if (changed) writeJSON(SESSION_FILE, sessions);
}

// User management
const DEFAULT_USERS = [
	{
		username: "CCA8798",
		displayName: "捌拐玖捌",
		group: "admin" as const,
		createdAt: new Date().toISOString(),
		bio: "站长",
	},
];

function readUsers(): Array<Record<string, unknown>> | null {
	const data = readJSON<{ users: Array<Record<string, unknown>> } | null>(
		USERS_FILE,
		null,
	);
	if (data && Array.isArray(data.users)) return data.users;
	return null;
}

function writeUsers(users: Array<Record<string, unknown>>): void {
	writeJSON(USERS_FILE, { users });
}

function initUsers(): Array<Record<string, unknown>> {
	const existing = readUsers();
	if (existing) return existing;
	const users = DEFAULT_USERS.map((u) => ({
		...u,
		password: hashPassword("lin20120103"),
	}));
	writeUsers(users);
	return users;
}

function findUser(username: string): Record<string, unknown> | null {
	const users = readUsers();
	if (!users) return null;
	return users.find((u) => u.username === username) || null;
}

function getGroup(username: string): string | null {
	const user = findUser(username);
	return user ? (user.group as string) : null;
}

function hasPermission(username: string, requiredGroup: string): boolean {
	const group = getGroup(username);
	if (!group) return false;
	return (GROUP_HIERARCHY[group] || 0) >= (GROUP_HIERARCHY[requiredGroup] || 0);
}

export const prerender = false;

export const GET: APIRoute = async () => {
	return new Response(JSON.stringify({ error: "Use POST" }), {
		status: 405,
		headers: { "Content-Type": "application/json", Allow: "POST" },
	});
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const ip =
		clientAddress ||
		request.headers.get("x-forwarded-for") ||
		request.headers.get("x-real-ip") ||
		"127.0.0.1";

	try {
		const body = await request.json();
		const {
			action,
			token,
			text,
			id,
			slug,
			title,
			published,
			tags,
			category,
			description,
			draft,
			body: postBody,
		} = body;

		// Register (no session required, public)
		if (action === "register") {
			const regUser = ((body.username as string) || "").trim();
			const regPass = body.password as string;
			const regConfirm = body.confirmPassword as string;
			const regDisplay = ((body.displayName as string) || "").trim() || regUser;
			const regBio = ((body.bio as string) || "").trim();
			const honeypot = body.honeypot as string;
			const pageLoad = Number(body.pageLoad);

			// Anti-automation: honeypot
			if (honeypot) {
				return new Response(JSON.stringify({ error: "无效的注册请求" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Anti-automation: time gate
			if (!pageLoad || Date.now() - pageLoad < REGISTER_MIN_TIME_MS) {
				return new Response(JSON.stringify({ error: "请稍后再试" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Validate fields
			if (!regUser || regUser.length < 2 || regUser.length > 20) {
				return new Response(JSON.stringify({ error: "用户名为 2-20 个字符" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(regUser)) {
				return new Response(
					JSON.stringify({ error: "用户名只能包含字母、数字、下划线和中文" }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				);
			}
			if (!regPass || regPass.length < 6) {
				return new Response(JSON.stringify({ error: "密码至少 6 个字符" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (regPass !== regConfirm) {
				return new Response(JSON.stringify({ error: "两次密码输入不一致" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Rate limit
			initUsers();
			const rateCheck = checkRegisterRate(ip);
			if (!rateCheck.allowed) {
				return new Response(
					JSON.stringify({
						error: `注册太频繁，请 ${rateCheck.remaining} 分钟后再试`,
					}),
					{ status: 429, headers: { "Content-Type": "application/json" } },
				);
			}

			// Check duplicate
			const users = readUsers() || [];
			if (users.find((u) => u.username === regUser)) {
				return new Response(JSON.stringify({ error: "用户名已存在" }), {
					status: 409,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Create user (default group: viewer)
			recordRegisterAttempt(ip);
			users.push({
				username: regUser,
				displayName: regDisplay,
				password: hashPassword(regPass),
				group: GROUPS.VIEWER,
				createdAt: new Date().toISOString(),
				bio: regBio,
			});
			writeUsers(users);

			// Auto-login after registration
			const sessionToken = createSession(ip, regUser);
			return new Response(
				JSON.stringify({
					success: true,
					token: sessionToken,
					user: {
						username: regUser,
						displayName: regDisplay,
						group: GROUPS.VIEWER,
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}

		// Login
		if (action === "login") {
			const check = checkRateLimit(ip);
			if (!check.allowed) {
				return new Response(
					JSON.stringify({
						error: `尝试次数过多，请 ${check.remaining} 分钟后再试`,
					}),
					{ status: 429, headers: { "Content-Type": "application/json" } },
				);
			}

			const loginUser = body.username as string | undefined;
			const loginPass = body.password as string;

			if (!loginUser || !loginPass) {
				return new Response(JSON.stringify({ error: "用户名和密码不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Ensure users.json exists for user-based auth
			initUsers();

			// Try user-based auth first
			const user = findUser(loginUser);
			if (user && user.password) {
				if (!verifyPassword(loginPass, user.password as string)) {
					recordFailedAttempt(ip);
					const rates = readJSON<RateData>(RATE_LIMIT_FILE, {});
					const remaining = MAX_ATTEMPTS - (rates[ip]?.count || 0);
					if (remaining <= 0) {
						const wait = Math.ceil(RATE_WINDOW_MS / 60000);
						return new Response(
							JSON.stringify({
								error: `密码错误次数过多，请 ${wait} 分钟后再试`,
							}),
							{ status: 429, headers: { "Content-Type": "application/json" } },
						);
					}
					return new Response(
						JSON.stringify({ error: `密码错误，还剩 ${remaining} 次机会` }),
						{ status: 401, headers: { "Content-Type": "application/json" } },
					);
				}
				clearRateLimit(ip);
				const sessionToken = createSession(ip, user.username as string);
				return new Response(
					JSON.stringify({
						success: true,
						token: sessionToken,
						user: {
							username: user.username,
							displayName:
								(user.displayName as string) || (user.username as string),
							group: user.group,
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			// Fallback: legacy password-only auth
			const adminPasswords = loadAdminPasswords();
			if (adminPasswords && adminPasswords.includes(loginPass)) {
				clearRateLimit(ip);
				initUsers();
				const adminUser = findUser("CCA8798");
				const sessionToken = createSession(ip, adminUser ? "CCA8798" : "admin");
				return new Response(
					JSON.stringify({
						success: true,
						token: sessionToken,
						user: {
							username: "CCA8798",
							displayName: "捌拐玖捌",
							group: "admin",
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			recordFailedAttempt(ip);
			const rates = readJSON<RateData>(RATE_LIMIT_FILE, {});
			const remaining = MAX_ATTEMPTS - (rates[ip]?.count || 0);
			if (remaining <= 0) {
				const wait = Math.ceil(RATE_WINDOW_MS / 60000);
				return new Response(
					JSON.stringify({ error: `尝试次数过多，请 ${wait} 分钟后再试` }),
					{ status: 429, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response(
				JSON.stringify({ error: `用户名或密码错误，还剩 ${remaining} 次机会` }),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}

		// All other actions require token validation
		const session = token ? validateSession(token) : null;
		if (!session) {
			return new Response(JSON.stringify({ error: "未登录或会话已过期" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const currentUser = session.username;

		// Periodic session cleanup
		cleanupSessions();

		// ---- Logout ----
		if (action === "logout") {
			deleteSession(token);
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// ---- User management (admin only) ----
		if (action === "userList") {
			if (!hasPermission(currentUser, GROUPS.ADMIN)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			const users = readUsers();
			if (!users)
				return new Response(JSON.stringify([]), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			const safeUsers = users.map((u) => ({
				username: u.username,
				displayName: u.displayName || u.username,
				group: u.group,
				createdAt: u.createdAt,
				bio: u.bio || "",
				hasPassword: !!u.password,
			}));
			return new Response(JSON.stringify(safeUsers), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (action === "userCreate") {
			if (!hasPermission(currentUser, GROUPS.ADMIN)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			const newUsername = body.username as string;
			const userPw = body.userPassword as string;
			if (!newUsername || !userPw) {
				return new Response(JSON.stringify({ error: "用户名和密码不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const users = readUsers() || [];
			if (users.find((u) => u.username === newUsername)) {
				return new Response(JSON.stringify({ error: "用户名已存在" }), {
					status: 409,
					headers: { "Content-Type": "application/json" },
				});
			}
			users.push({
				username: newUsername,
				displayName: (body.displayName as string) || newUsername,
				password: hashPassword(userPw),
				group: (body.userGroup as string) || GROUPS.VIEWER,
				createdAt: new Date().toISOString(),
				bio: (body.userBio as string) || "",
			});
			writeUsers(users);
			return new Response(
				JSON.stringify({ success: true, username: newUsername }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (action === "userUpdate") {
			if (!hasPermission(currentUser, GROUPS.ADMIN)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			const editUsername = body.username as string;
			if (!editUsername) {
				return new Response(JSON.stringify({ error: "用户名不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const users = readUsers() || [];
			const idx = users.findIndex((u) => u.username === editUsername);
			if (idx === -1) {
				return new Response(JSON.stringify({ error: "用户不存在" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (body.displayName !== undefined)
				users[idx].displayName = body.displayName;
			if (body.userGroup !== undefined) users[idx].group = body.userGroup;
			if (body.userBio !== undefined) users[idx].bio = body.userBio;
			if (body.userPassword)
				users[idx].password = hashPassword(body.userPassword as string);
			writeUsers(users);
			return new Response(
				JSON.stringify({ success: true, username: editUsername }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		if (action === "userDelete") {
			if (!hasPermission(currentUser, GROUPS.ADMIN)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			const delUsername = body.username as string;
			if (!delUsername) {
				return new Response(JSON.stringify({ error: "用户名不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (delUsername === "CCA8798") {
				return new Response(
					JSON.stringify({ error: "不能删除初始管理员账号" }),
					{
						status: 403,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			const users = readUsers() || [];
			const idx = users.findIndex((u) => u.username === delUsername);
			if (idx === -1) {
				return new Response(JSON.stringify({ error: "用户不存在" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			users.splice(idx, 1);
			writeUsers(users);
			return new Response(
				JSON.stringify({ success: true, username: delUsername }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const data = readStatus();

		// List status + history
		if (action === "list") {
			if (!hasPermission(currentUser, GROUPS.VIEWER)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(
				JSON.stringify({ current: data.current, history: data.history }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Update current status (adds to history)
		if (action === "updateCurrent") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!text || typeof text !== "string" || !text.trim()) {
				return new Response(JSON.stringify({ error: "状态内容不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const entry: StatusEntry = {
				id: generateId(),
				text: text.trim(),
				updatedAt: new Date().toISOString(),
			};
			data.current = entry;
			data.history.unshift(entry);
			if (data.history.length > MAX_HISTORY) {
				data.history = data.history.slice(0, MAX_HISTORY);
			}
			writeStatus(data);
			return new Response(JSON.stringify({ success: true, entry }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Create a history entry without changing current
		if (action === "create") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!text || typeof text !== "string" || !text.trim()) {
				return new Response(JSON.stringify({ error: "状态内容不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const entry: StatusEntry = {
				id: generateId(),
				text: text.trim(),
				updatedAt: new Date().toISOString(),
			};
			data.history.unshift(entry);
			if (data.history.length > MAX_HISTORY) {
				data.history = data.history.slice(0, MAX_HISTORY);
			}
			writeStatus(data);
			return new Response(JSON.stringify({ success: true, entry }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Edit a history entry by ID
		if (action === "edit") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!id || typeof id !== "string") {
				return new Response(JSON.stringify({ error: "缺少 ID" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!text || typeof text !== "string" || !text.trim()) {
				return new Response(JSON.stringify({ error: "状态内容不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const idx = data.history.findIndex((e) => e.id === id);
			if (idx === -1) {
				return new Response(JSON.stringify({ error: "未找到该记录" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			data.history[idx].text = text.trim();
			// If editing the current status, sync text
			if (data.current.id === id) {
				data.current.text = text.trim();
			}
			writeStatus(data);
			return new Response(
				JSON.stringify({ success: true, entry: data.history[idx] }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Delete a history entry by ID
		if (action === "delete") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!id || typeof id !== "string") {
				return new Response(JSON.stringify({ error: "缺少 ID" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const idx = data.history.findIndex((e) => e.id === id);
			if (idx === -1) {
				return new Response(JSON.stringify({ error: "未找到该记录" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			const removed = data.history.splice(idx, 1)[0];
			// If deleting current, set current to latest remaining or empty
			if (data.current.id === id) {
				data.current =
					data.history.length > 0
						? { ...data.history[0] }
						: { id: generateId(), text: "", updatedAt: null };
			}
			writeStatus(data);
			return new Response(JSON.stringify({ success: true, entry: removed }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// --- Post CRUD ---

		// List all posts
		if (action === "postList") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			const posts = readPostList();
			return new Response(JSON.stringify(posts), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get single post
		if (action === "postGet") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!slug || typeof slug !== "string") {
				return new Response(JSON.stringify({ error: "缺少 slug" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const post = readPost(slug);
			if (!post) {
				return new Response(JSON.stringify({ error: "未找到文章" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response(JSON.stringify(post), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Create new post
		if (action === "postCreate") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!slug || typeof slug !== "string" || !slug.trim()) {
				return new Response(JSON.stringify({ error: "slug 不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!title || typeof title !== "string" || !title.trim()) {
				return new Response(JSON.stringify({ error: "标题不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const postDir = path.join(POSTS_DIR, slug.trim());
			if (fs.existsSync(postDir)) {
				return new Response(JSON.stringify({ error: "该 slug 已存在" }), {
					status: 409,
					headers: { "Content-Type": "application/json" },
				});
			}
			const pub = String(published || new Date().toISOString());
			const fmData: Record<string, unknown> = {
				title: title.trim(),
				published: pub,
			};
			if (description) fmData.description = String(description).trim();
			if (tags && Array.isArray(tags)) fmData.tags = tags;
			if (category) fmData.category = String(category).trim();
			if (draft !== undefined) fmData.draft = draft;
			fmData.author = body.author ? String(body.author).trim() : currentUser;
			fmData.lang = "";
			const frontmatter = buildFrontmatter(fmData);
			const mdBody = typeof postBody === "string" ? postBody : "";
			const fileContent = frontmatter + "\n" + mdBody;
			try {
				fs.mkdirSync(postDir, { recursive: true });
				fs.writeFileSync(path.join(postDir, "index.md"), fileContent, "utf-8");
				return new Response(
					JSON.stringify({ success: true, slug: slug.trim() }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (err) {
				console.error("创建文章失败:", err);
				return new Response(JSON.stringify({ error: "创建文章失败" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// Update existing post
		if (action === "postUpdate") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!slug || typeof slug !== "string" || !slug.trim()) {
				return new Response(JSON.stringify({ error: "slug 不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const filePath = findPostFile(slug.trim());
			if (!filePath) {
				return new Response(JSON.stringify({ error: "未找到文章" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			const existing = fs.readFileSync(filePath, "utf-8");
			const { data: oldData, body: oldBody } = parseFrontmatter(existing);
			const newData: Record<string, unknown> = { ...oldData };
			if (title !== undefined) newData.title = String(title).trim();
			if (published !== undefined) newData.published = String(published);
			if (description !== undefined)
				newData.description = String(description).trim();
			if (tags !== undefined && Array.isArray(tags)) newData.tags = tags;
			if (category !== undefined) newData.category = String(category).trim();
			if (draft !== undefined) newData.draft = draft;
			if (body.author !== undefined)
				newData.author = String(body.author).trim();
			const frontmatter = buildFrontmatter(newData);
			const mdBody = typeof postBody === "string" ? postBody : oldBody;
			const fileContent = `${frontmatter}\n${mdBody}`;
			try {
				fs.writeFileSync(filePath, fileContent, "utf-8");
				return new Response(
					JSON.stringify({ success: true, slug: slug.trim() }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (err) {
				console.error("更新文章失败:", err);
				return new Response(JSON.stringify({ error: "更新文章失败" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// Delete post
		if (action === "postDelete") {
			if (!hasPermission(currentUser, GROUPS.ADMIN)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!slug || typeof slug !== "string" || !slug.trim()) {
				return new Response(JSON.stringify({ error: "slug 不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const postDir = path.join(POSTS_DIR, slug.trim());
			if (!fs.existsSync(postDir)) {
				return new Response(JSON.stringify({ error: "未找到文章" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			try {
				fs.rmSync(postDir, { recursive: true, force: true });
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			} catch (err) {
				console.error("删除文章失败:", err);
				return new Response(JSON.stringify({ error: "删除文章失败" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		if (action === "postUploadImage") {
			if (!hasPermission(currentUser, GROUPS.EDITOR)) {
				return new Response(JSON.stringify({ error: "权限不足" }), {
					status: 403,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (!slug || typeof slug !== "string" || !slug.trim()) {
				return new Response(JSON.stringify({ error: "slug 不能为空" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const { filename, data } = body as { filename: string; data: string };
			if (
				!filename ||
				typeof filename !== "string" ||
				!data ||
				typeof data !== "string"
			) {
				return new Response(
					JSON.stringify({ error: "filename 或 data 缺失" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const base64Prefix = "data:image/";
			if (!data.startsWith(base64Prefix)) {
				return new Response(JSON.stringify({ error: "仅支持图片上传" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const semiColonIdx = data.indexOf(";");
			const commaIdx = data.indexOf(",");
			if (semiColonIdx === -1 || commaIdx === -1) {
				return new Response(JSON.stringify({ error: "数据格式错误" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}
			const mimeType = data.slice(base64Prefix.length, semiColonIdx);
			const base64Data = data.slice(commaIdx + 1);

			const safeFilename = path
				.basename(filename)
				.replace(/[^a-zA-Z0-9._-]/g, "");
			if (!safeFilename) {
				return new Response(JSON.stringify({ error: "文件名无效" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const maxSize = 5 * 1024 * 1024;
			const buffer = Buffer.from(base64Data, "base64");
			if (buffer.length > maxSize) {
				return new Response(JSON.stringify({ error: "文件大小超过 5MB" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const postDir = path.join(POSTS_DIR, slug.trim());
			try {
				fs.mkdirSync(postDir, { recursive: true });
				const filePath = path.join(postDir, safeFilename);
				fs.writeFileSync(filePath, buffer);
				return new Response(JSON.stringify({ path: `./${safeFilename}` }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			} catch (err) {
				console.error("图片上传失败:", err);
				return new Response(JSON.stringify({ error: "图片上传失败" }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		return new Response(JSON.stringify({ error: "未知操作" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	} catch (err) {
		console.error("Admin API 错误:", err);
		return new Response(JSON.stringify({ error: "服务器内部错误" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
