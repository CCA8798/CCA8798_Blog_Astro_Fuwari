/**
 * waline-runtime.cjs — Waline 评论系统共享运行时
 *
 * 同时被两种运行环境使用，保证行为完全一致：
 *  1. server.cjs（生产，Express）：app.use('/waline', createWalineMiddleware())
 *  2. astro dev（开发，vite）：   vite plugin configureServer 挂载同一中间件
 *
 * 设计要点：
 *  - JWT 密钥持久化到 data/waline/.jwt-secret，dev/server 重启之间保持一致
 *  - LOGIN=enable：游客可填写昵称/邮箱评论，站内已登录用户通过桥接 token 成为博主身份
 *  - 内建 OAuth stub（services: []），评论面板不展示第三方登录入口
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const jwt = require('jsonwebtoken');

const ROOT_DIR = __dirname;
const WALINE_DATA_DIR = path.join(ROOT_DIR, 'data', 'waline');
const WALINE_DB_PATH = path.join(WALINE_DATA_DIR, 'waline.sqlite');
const WALINE_SECRET_FILE = path.join(WALINE_DATA_DIR, '.jwt-secret');

// 后台管理面板超级管理员（播种用，密码经 phpass 哈希后入库）
// 注意:密码必须通过环境变量 WALINE_SUPER_ADMIN_PASSWORD 注入(见 start.ps1),
// 严禁硬编码明文写入仓库 —— 本文件会被推送到公开 GitHub。
const SUPER_ADMIN_EMAIL = '2044187229@qq.com';
const SUPER_ADMIN_PASSWORD = process.env.WALINE_SUPER_ADMIN_PASSWORD;
const SUPER_ADMIN_NAME = '捌拐玖捌';

/**
 * 解析 phpass 模块（Waline 服务端登录用 phpass.checkPassword 校验密码）。
 * pnpm 布局下项目根没有 phpass 符号链接，需多重回退：
 *  1. 直接 require（若根 node_modules 有链接）
 *  2. createRequire 从项目根解析
 *  3. 扫描 node_modules/.pnpm 下的 phpass@* 包（不硬编码版本路径）
 */
function resolvePhpass() {
	const attempts = [
		() => require('phpass'),
		() => {
			const { createRequire } = require('module');
			return createRequire(path.join(ROOT_DIR, 'package.json'))('phpass');
		},
		() => {
			const pnpmDir = path.join(ROOT_DIR, 'node_modules', '.pnpm');
			if (fs.existsSync(pnpmDir)) {
				const matches = fs.readdirSync(pnpmDir).filter((d) => d.startsWith('phpass@'));
				for (const m of matches) {
					const pkgPath = path.join(pnpmDir, m, 'node_modules', 'phpass');
					if (fs.existsSync(path.join(pkgPath, 'package.json'))) return require(pkgPath);
				}
			}
			throw new Error('phpass not found in node_modules/.pnpm');
		},
	];
	for (const attempt of attempts) {
		try {
			return attempt();
		} catch {}
	}
	throw new Error('[waline] 无法解析 phpass 模块，请确认已安装 phpass 依赖');
}

// 评论限流：每 IP 180 秒最多 3 条（内存表）
const COMMENT_LIMIT_MAX = 3;
const COMMENT_LIMIT_WINDOW_MS = 180 * 1000;
const commentRate = new Map(); // ip -> timestamp[]

const GROUPS = { ADMIN: 'admin', EDITOR: 'editor', VIEWER: 'viewer' };
const GROUP_HIERARCHY = { admin: 3, editor: 2, viewer: 1 };

// Waline 官方 SQLite schema（来自 waline.sqlite.sql）
const WALINE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "wl_Comment" ("id" INTEGER, "user_id" INTEGER, "comment" TEXT, "insertedAt" DATETIME DEFAULT (datetime('now','localtime')), "ip" TEXT, "link" TEXT, "mail" TEXT, "nick" TEXT, "rid" INTEGER, "pid" INTEGER, "sticky" NUMERIC, "status" TEXT NOT NULL, "like" INTEGER, "ua" TEXT, "url" TEXT, "createdAt" DATETIME DEFAULT (datetime('now','localtime')), "updatedAt" DATETIME DEFAULT (datetime('now','localtime')), PRIMARY KEY("id" AUTOINCREMENT));
CREATE TABLE IF NOT EXISTS "wl_Counter" ("id" INTEGER, "time" INTEGER, "reaction0" INTEGER, "reaction1" INTEGER, "reaction2" INTEGER, "reaction3" INTEGER, "reaction4" INTEGER, "reaction5" INTEGER, "reaction6" INTEGER, "reaction7" INTEGER, "reaction8" INTEGER, "url" TEXT, "createdAt" DATETIME DEFAULT (datetime('now','localtime')), "updatedAt" DATETIME DEFAULT (datetime('now','localtime')), PRIMARY KEY("id" AUTOINCREMENT));
CREATE TABLE IF NOT EXISTS "wl_Users" ("id" INTEGER, "display_name" TEXT NOT NULL DEFAULT "", "email" TEXT NOT NULL DEFAULT "", "password" TEXT NOT NULL DEFAULT "", "type" TEXT NOT NULL DEFAULT "", "label" TEXT, "github" TEXT, "twitter" TEXT, "facebook" TEXT, "google" TEXT, "weibo" TEXT, "qq" TEXT, "oidc" TEXT, "huawei" TEXT, "2fa" TEXT, "avatar" TEXT, "url" TEXT, "createdAt" DATETIME DEFAULT (datetime('now','localtime')), "updatedAt" DATETIME DEFAULT (datetime('now','localtime')), PRIMARY KEY("id" AUTOINCREMENT));
`;

/** 获取持久化的 JWT 密钥（生成一次后写入文件，重启不失效） */
function getWalineSecret() {
	if (process.env.WALINE_JWT_SECRET) return process.env.WALINE_JWT_SECRET;
	try {
		if (fs.existsSync(WALINE_SECRET_FILE)) {
			return fs.readFileSync(WALINE_SECRET_FILE, 'utf-8').trim();
		}
		fs.mkdirSync(WALINE_DATA_DIR, { recursive: true });
		const secret = crypto.randomBytes(32).toString('hex');
		fs.writeFileSync(WALINE_SECRET_FILE, secret, { encoding: 'utf-8', mode: 0o600 });
		console.log('[waline] 已持久化 JWT 密钥到 data/waline/.jwt-secret');
		return secret;
	} catch (e) {
		console.warn('[waline] 持久化密钥失败，使用内存随机密钥:', e.message);
		return crypto.randomBytes(32).toString('hex');
	}
}

/** OAuth stub：Waline 每次请求 /request 都会访问 OAUTH_URL 且无超时，必须内置本地 stub */
let oauthStubServer = null;
let oauthStubPort = 0;

function startOauthStub() {
	return new Promise((resolve) => {
		if (oauthStubServer && oauthStubServer.listening) {
			process.env.OAUTH_URL = `http://127.0.0.1:${oauthStubPort}`;
			return resolve();
		}
		oauthStubServer = http.createServer((req, res) => {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ services: [] }));
		});
		oauthStubServer.listen(0, '127.0.0.1', () => {
			oauthStubPort = oauthStubServer.address().port;
			process.env.OAUTH_URL = `http://127.0.0.1:${oauthStubPort}`;
			resolve();
		});
	});
}

/** 确保 Waline SQLite schema 存在 */
function ensureWalineSchema() {
	const Database = require('better-sqlite3');
	if (!fs.existsSync(WALINE_DATA_DIR)) fs.mkdirSync(WALINE_DATA_DIR, { recursive: true });
	const db = new Database(WALINE_DB_PATH);
	try {
		db.exec(WALINE_SCHEMA_SQL);
	} finally {
		db.close();
	}
	return WALINE_DB_PATH;
}

/** 查询/创建 Waline 用户（以 email 为准），返回 wl_Users.id */
function getOrCreateWalineUser(username, displayName, group) {
	const Database = require('better-sqlite3');
	const email = `${username}@waline.cca8798.com`;
	const db = new Database(WALINE_DB_PATH);
	try {
		const existing = db.prepare('SELECT id FROM wl_Users WHERE email = ?').get(email);
		if (existing) return Number(existing.id);
		const isAdmin = GROUP_HIERARCHY[group] >= GROUP_HIERARCHY[GROUPS.ADMIN];
		const type = isAdmin ? 'administrator' : '';
		const info = db
			.prepare('INSERT INTO wl_Users (display_name, email, password, type) VALUES (?, ?, ?, ?)')
			.run(displayName || username, email, '', type);
		return Number(info.lastInsertRowid);
	} finally {
		db.close();
	}
}

/**
 * 幂等播种后台管理面板超级管理员（以 email 为准）。
 * 已存在则 UPDATE 密码/昵称/类型（保证密码始终为最新 phpass 哈希），否则 INSERT。
 * 返回 wl_Users.id。
 */
function ensureSuperAdminAccount() {
	const Database = require('better-sqlite3');
	const { PasswordHash } = resolvePhpass();
	if (!SUPER_ADMIN_PASSWORD) {
		// 未通过环境变量注入密码:跳过播种/改密,避免用 undefined 覆盖库中已有账户
		console.warn(
			'[waline] 未设置环境变量 WALINE_SUPER_ADMIN_PASSWORD, 跳过超级管理员密码同步 (请通过 start.ps1 注入)',
		);
		return undefined;
	}
	const hash = new PasswordHash().hashPassword(SUPER_ADMIN_PASSWORD);
	if (!fs.existsSync(WALINE_DATA_DIR)) fs.mkdirSync(WALINE_DATA_DIR, { recursive: true });
	const db = new Database(WALINE_DB_PATH);
	try {
		const existing = db
			.prepare('SELECT id FROM wl_Users WHERE email = ?')
			.get(SUPER_ADMIN_EMAIL);
		if (existing) {
			db.prepare(
				"UPDATE wl_Users SET password = ?, display_name = ?, type = ?, updatedAt = datetime('now','localtime') WHERE email = ?",
			).run(hash, SUPER_ADMIN_NAME, 'administrator', SUPER_ADMIN_EMAIL);
			return Number(existing.id);
		}
		const info = db
			.prepare('INSERT INTO wl_Users (display_name, email, password, type) VALUES (?, ?, ?, ?)')
			.run(SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, hash, 'administrator');
		return Number(info.lastInsertRowid);
	} finally {
		db.close();
	}
}

/** 为已登录用户签发 Waline 评论 token（与 Waline 内部 JWT 同密钥） */
function mintWalineToken(username, displayName, group) {
	const id = getOrCreateWalineUser(username, displayName, group);
	return jwt.sign(String(id), getWalineSecret());
}

let walineHandler = null;
let walineInitPromise = null;

/** 初始化 Waline handler（幂等，返回 factory 的 handler） */
function initWaline() {
	if (walineInitPromise) return walineInitPromise;
	walineInitPromise = (async () => {
		await startOauthStub();
		process.env.SQLITE_PATH = WALINE_DATA_DIR;
		process.env.JWT_TOKEN = getWalineSecret();
		process.env.LOGIN = 'force'; // 强制登录：未登录游客 POST /api/comment 返回 401，不允许游客评论
		process.env.AKISMET_KEY = 'false';
		process.env.DISABLE_REGION = 'true';
		process.env.DISABLE_USERAGENT = 'true';
		process.env.NODE_ENV = 'production';
		process.env.THINK_UNIT_TEST = '1';
		ensureWalineSchema();
		const superAdminId = ensureSuperAdminAccount();
		const walineFactory = require('@waline/vercel');
		walineHandler = walineFactory({ env: 'production' });
		console.log(
			`[waline] handler 已就绪 (SQLITE_PATH=${WALINE_DATA_DIR}, LOGIN=force, 超级管理员: ${
				superAdminId ? `已同步 (wl_Users.id=${superAdminId})` : '跳过密码同步'
			})`,
		);
		return walineHandler;
	})();
	return walineInitPromise;
}

/** 从请求头提取客户端 IP（兼容代理） */
function getClientIP(req) {
	// Express/Vite 的 socket.remoteAddress 与 forwarded 头
	const fwd = req.headers['x-forwarded-for'];
	if (fwd) {
		const first = String(fwd).split(',')[0].trim();
		if (first) return first;
	}
	if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
	return req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : 'unknown';
}

/**
 * 创建 /waline 中间件（express 与 vite connect 通用）
 * - 剥掉已挂载去除后的残余 /waline 前缀
 * - 发布评论前做内存限流（3 条 / 180s）
 * - 将请求转交给 Waline handler
 */
function createWalineMiddleware() {
	return async (req, res, next) => {
		try {
			const handler = await initWaline();

			// 剥残余前缀：依赖挂载点是否已剥离 /waline（Express app.use 会剥，vite 不会）
			if (req.url && req.url.startsWith('/waline')) {
				req.url = req.url.slice('/waline'.length) || '/';
			}

			// 让 Waline 后台/验证链接正确解析：SERVER_URL 需带 /waline 前缀，
			// 否则 dashboard.js 渲染的 window.serverURL 会变成 https://host/api/（缺少前缀而 404）
			const proto = req.socket && req.socket.encrypted ? 'https' : 'http';
			process.env.SERVER_URL = `${proto}://${req.headers.host}/waline`;

			// 发布评论限流
			const isCommentPost =
				req.method === 'POST' &&
				(req.url === '/api/comment' || req.url.startsWith('/api/comment?'));
			if (isCommentPost) {
				const ip = getClientIP(req);
				const now = Date.now();
				const list = (commentRate.get(ip) || []).filter((t) => now - t < COMMENT_LIMIT_WINDOW_MS);
				if (list.length >= COMMENT_LIMIT_MAX) {
					const waitSec = Math.ceil((COMMENT_LIMIT_WINDOW_MS - (now - list[0])) / 1000);
					return res.status(429).json({ errno: 429, errmsg: `评论太频繁，请 ${waitSec} 秒后再试` });
				}
				list.push(now);
				commentRate.set(ip, list);
			}

			const p = handler(req, res);
			if (p && typeof p.then === 'function') {
				p.then(
					() => {},
					(e) => {
						try {
							if (!res.headersSent) res.status(500).json({ errno: 500, errmsg: String(e) });
							else res.end();
						} catch {}
					},
				);
			}
			// 不调用 next：Waline 会自行结束响应
		} catch (e) {
			if (next && typeof next === 'function') {
				// vite connect 环境下交由后续错误处理（避免挂死）
				try {
					if (!res.headersSent) res.status(500).json({ errno: 500, errmsg: String(e) });
					else res.end();
				} catch {}
			} else {
				try {
					if (!res.headersSent) res.status(500).json({ errno: 500, errmsg: String(e) });
				} catch {}
			}
		}
	};
}

module.exports = {
	WALINE_DATA_DIR,
	WALINE_DB_PATH,
	initWaline,
	ensureWalineSchema,
	ensureSuperAdminAccount,
	getOrCreateWalineUser,
	mintWalineToken,
	createWalineMiddleware,
	getClientIP,
	GROUPS,
};