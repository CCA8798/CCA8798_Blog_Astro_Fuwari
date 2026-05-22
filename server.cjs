const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const STATUS_FILE = path.join(__dirname, 'status.json');
const RATE_LIMIT_FILE = path.join(__dirname, 'rate-limit.json');
const SESSION_FILE = path.join(__dirname, 'admin-session.json');
const MAX_HISTORY = 200;
const MAX_ATTEMPTS = 3;
const RATE_WINDOW_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lin20120103';
const POSTS_DIR = path.join(__dirname, 'src/content/posts');

function parseFrontmatter(content) {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: content };
	const yaml = match[1];
	const body = match[2];
	const data = {};
	for (const line of yaml.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) continue;
		const key = trimmed.slice(0, colonIdx).trim();
		let raw = trimmed.slice(colonIdx + 1).trim();
		if (!raw) { data[key] = ''; continue; }
		if (raw === 'true') data[key] = true;
		else if (raw === 'false') data[key] = false;
		else if (/^[-\d]+(?:\.[\d]+)?$/.test(raw)) data[key] = Number(raw);
		else if (raw.startsWith('[') && raw.endsWith(']')) {
			try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
		} else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
			data[key] = raw.slice(1, -1);
		} else {
			data[key] = raw;
		}
	}
	return { data, body };
}

function buildFrontmatter(data) {
	const lines = ['---'];
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value)) {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		} else if (typeof value === 'boolean') {
			lines.push(`${key}: ${value}`);
		} else if (typeof value === 'number') {
			lines.push(`${key}: ${value}`);
		} else {
			const s = String(value);
			if (/[^\w\-\/:\s.]/.test(s) || s.includes('\n')) {
				lines.push(`${key}: "${s.replace(/"/g, '\\"')}"`);
			} else {
				lines.push(`${key}: ${s}`);
			}
		}
	}
	lines.push('---');
	return lines.join('\n');
}

function findPostFile(slug) {
	const dir = path.join(POSTS_DIR, slug);
	if (!fs.existsSync(dir)) return null;
	const md = path.join(dir, 'index.md');
	if (fs.existsSync(md)) return md;
	const mdx = path.join(dir, 'index.mdx');
	if (fs.existsSync(mdx)) return mdx;
	return null;
}

function readPostList() {
	const result = [];
	try {
		const dirs = fs.readdirSync(POSTS_DIR, { withFileTypes: true });
		for (const dir of dirs) {
			if (!dir.isDirectory()) continue;
			const filePath = findPostFile(dir.name);
			if (!filePath) continue;
			const content = fs.readFileSync(filePath, 'utf-8');
			const { data } = parseFrontmatter(content);
			result.push({
				slug: dir.name,
				title: data.title || dir.name,
				published: data.published || '',
				draft: data.draft || false,
				tags: data.tags || [],
				category: data.category || '',
				description: data.description || '',
			});
		}
	} catch {}
	result.sort((a, b) => {
		if (!a.published) return 1;
		if (!b.published) return -1;
		return new Date(b.published).getTime() - new Date(a.published).getTime();
	});
	return result;
}

function readPost(slug) {
	const filePath = findPostFile(slug);
	if (!filePath) return null;
	const content = fs.readFileSync(filePath, 'utf-8');
	const { data, body } = parseFrontmatter(content);
	return {
		slug,
		title: data.title || slug,
		published: data.published || '',
		draft: data.draft || false,
		tags: data.tags || [],
		category: data.category || '',
		description: data.description || '',
		body,
	};
}

function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readJSON(file, fallback) {
	try {
		if (fs.existsSync(file)) {
			return JSON.parse(fs.readFileSync(file, 'utf-8'));
		}
	} catch {}
	return fallback;
}

function writeJSON(file, data) {
	fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function readStatus() {
	try {
		if (fs.existsSync(STATUS_FILE)) {
			const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
			const data = JSON.parse(raw);
			if (data.current !== undefined) {
				if (data.current.id === undefined) data.current.id = generateId();
				for (let i = 0; i < (data.history ?? []).length; i++) {
					if (data.history[i].id === undefined) data.history[i].id = generateId();
				}
				return data;
			}
			const id = generateId();
			return {
				current: { id, text: data.text ?? '', updatedAt: data.updatedAt ?? null },
				history: data.history ?? [],
			};
		}
	} catch {}
	const id = generateId();
	return { current: { id, text: '', updatedAt: null }, history: [] };
}

function writeStatus(data) {
	writeJSON(STATUS_FILE, data);
}

function getClientIP(req) {
	return req.headers['x-forwarded-for']
		|| req.headers['x-real-ip']
		|| req.socket?.remoteAddress
		|| '127.0.0.1';
}

function checkRateLimit(ip) {
	const rates = readJSON(RATE_LIMIT_FILE, {});
	const now = Date.now();
	if (rates[ip]) {
		if (now - rates[ip].firstAttempt > RATE_WINDOW_MS) {
			delete rates[ip];
			writeJSON(RATE_LIMIT_FILE, rates);
			return { allowed: true };
		}
		if (rates[ip].count >= MAX_ATTEMPTS) {
			const remaining = Math.ceil((rates[ip].firstAttempt + RATE_WINDOW_MS - now) / 60000);
			return { allowed: false, remaining };
		}
	}
	return { allowed: true };
}

function recordFailedAttempt(ip) {
	const rates = readJSON(RATE_LIMIT_FILE, {});
	const now = Date.now();
	if (!rates[ip] || now - rates[ip].firstAttempt > RATE_WINDOW_MS) {
		rates[ip] = { count: 1, firstAttempt: now };
	} else {
		rates[ip].count++;
	}
	writeJSON(RATE_LIMIT_FILE, rates);
}

function clearRateLimit(ip) {
	const rates = readJSON(RATE_LIMIT_FILE, {});
	delete rates[ip];
	writeJSON(RATE_LIMIT_FILE, rates);
}

function createSession(ip) {
	const token = crypto.randomUUID();
	const sessions = readJSON(SESSION_FILE, {});
	sessions[token] = { ip, createdAt: Date.now() };
	writeJSON(SESSION_FILE, sessions);
	return token;
}

function validateSession(token, ip) {
	const sessions = readJSON(SESSION_FILE, {});
	const session = sessions[token];
	if (!session) return false;
	if (Date.now() - session.createdAt > SESSION_TTL_MS) {
		delete sessions[token];
		writeJSON(SESSION_FILE, sessions);
		return false;
	}
	return session.ip === ip;
}

function cleanupSessions() {
	const sessions = readJSON(SESSION_FILE, {});
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

// --- Public API: status.json ---
app.get('/api/status.json', (req, res) => {
	try {
		const jsonPath = path.join(__dirname, 'list.json');
		const rawData = fs.readFileSync(jsonPath, 'utf-8');
		const jsonData = JSON.parse(rawData);
		res.json(jsonData);
	} catch (err) {
		console.error('读取 list.json 失败:', err);
		res.status(500).json({ error: 'Failed to load data' });
	}
});

// --- Public API: status read/update ---
app.get('/api/status', (req, res) => {
	const textParam = req.query.text;

	if (textParam !== undefined) {
		const token = process.env.STATUS_TOKEN;
		if (token && req.query.token !== token) {
			return res.status(401).json({ error: 'Invalid token' });
		}

		const text = String(textParam).trim();
		const entry = { id: generateId(), text, updatedAt: new Date().toISOString() };

		try {
			const data = readStatus();
			data.current = entry;
			data.history.unshift(entry);
			if (data.history.length > MAX_HISTORY) {
				data.history = data.history.slice(0, MAX_HISTORY);
			}
			writeStatus(data);
			return res.json({ success: true, status: entry });
		} catch (err) {
			console.error('写入 status.json 失败:', err);
			return res.status(500).json({ error: 'Failed to save status' });
		}
	}

	if (req.query.history !== undefined) {
		try {
			const data = readStatus();
			return res.json(data.history);
		} catch (err) {
			console.error('读取历史失败:', err);
			return res.json([]);
		}
	}

	try {
		const data = readStatus();
		res.json(data.current);
	} catch (err) {
		console.error('读取 status.json 失败:', err);
		res.status(500).json({ error: 'Failed to load status' });
	}
});

// 兼容旧版
app.get('/api/status/update', (req, res) => {
	res.redirect(301, '/api/status?' + new URLSearchParams(req.query).toString());
});

// --- Admin API: login + CRUD ---
app.post('/api/admin', (req, res) => {
	const ip = getClientIP(req);
	const { action, password, token, text, id, slug, title, published, tags, category, description, draft, body: postBody } = req.body;

	if (action === 'login') {
		const check = checkRateLimit(ip);
		if (!check.allowed) {
			return res.status(429).json({ error: `尝试次数过多，请 ${check.remaining} 分钟后再试` });
		}

		if (password !== ADMIN_PASSWORD) {
			recordFailedAttempt(ip);
			const rates = readJSON(RATE_LIMIT_FILE, {});
			const remaining = MAX_ATTEMPTS - (rates[ip]?.count || 0);
			if (remaining <= 0) {
				const wait = Math.ceil(RATE_WINDOW_MS / 60000);
				return res.status(429).json({ error: `密码错误次数过多，请 ${wait} 分钟后再试` });
			}
			return res.status(401).json({ error: `密码错误，还剩 ${remaining} 次机会` });
		}

		clearRateLimit(ip);
		const sessionToken = createSession(ip);
		return res.json({ success: true, token: sessionToken });
	}

	if (!token || !validateSession(token, ip)) {
		return res.status(401).json({ error: '未登录或会话已过期' });
	}

	cleanupSessions();
	const data = readStatus();

	if (action === 'list') {
		return res.json({ current: data.current, history: data.history });
	}

	if (action === 'updateCurrent') {
		if (!text || typeof text !== 'string' || !text.trim()) {
			return res.status(400).json({ error: '状态内容不能为空' });
		}
		const entry = { id: generateId(), text: text.trim(), updatedAt: new Date().toISOString() };
		data.current = entry;
		data.history.unshift(entry);
		if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);
		writeStatus(data);
		return res.json({ success: true, entry });
	}

	if (action === 'create') {
		if (!text || typeof text !== 'string' || !text.trim()) {
			return res.status(400).json({ error: '状态内容不能为空' });
		}
		const entry = { id: generateId(), text: text.trim(), updatedAt: new Date().toISOString() };
		data.history.unshift(entry);
		if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);
		writeStatus(data);
		return res.json({ success: true, entry });
	}

	if (action === 'edit') {
		if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少 ID' });
		if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: '状态内容不能为空' });
		const idx = data.history.findIndex(e => e.id === id);
		if (idx === -1) return res.status(404).json({ error: '未找到该记录' });
		data.history[idx].text = text.trim();
		if (data.current.id === id) data.current.text = text.trim();
		writeStatus(data);
		return res.json({ success: true, entry: data.history[idx] });
	}

	if (action === 'delete') {
		if (!id || typeof id !== 'string') return res.status(400).json({ error: '缺少 ID' });
		const idx = data.history.findIndex(e => e.id === id);
		if (idx === -1) return res.status(404).json({ error: '未找到该记录' });
		const removed = data.history.splice(idx, 1)[0];
		if (data.current.id === id) {
			data.current = data.history.length > 0
				? { ...data.history[0] }
				: { id: generateId(), text: '', updatedAt: null };
		}
		writeStatus(data);
		return res.json({ success: true, entry: removed });
	}

	// --- Post CRUD ---

	if (action === 'postList') {
		return res.json(readPostList());
	}

	if (action === 'postGet') {
		if (!slug || typeof slug !== 'string') return res.status(400).json({ error: '缺少 slug' });
		const post = readPost(slug);
		if (!post) return res.status(404).json({ error: '未找到文章' });
		return res.json(post);
	}

	if (action === 'postCreate') {
		if (!slug || typeof slug !== 'string' || !slug.trim()) return res.status(400).json({ error: 'slug 不能为空' });
		if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: '标题不能为空' });
		const postDir = path.join(POSTS_DIR, slug.trim());
		if (fs.existsSync(postDir)) return res.status(409).json({ error: '该 slug 已存在' });
		const pub = String(published || new Date().toISOString());
		const fmData = { title: title.trim(), published: pub };
		if (description) fmData.description = String(description).trim();
		if (tags && Array.isArray(tags)) fmData.tags = tags;
		if (category) fmData.category = String(category).trim();
		if (draft !== undefined) fmData.draft = draft;
		fmData.lang = '';
		const frontmatter = buildFrontmatter(fmData);
		const mdBody = typeof postBody === 'string' ? postBody : '';
		try {
			fs.mkdirSync(postDir, { recursive: true });
			fs.writeFileSync(path.join(postDir, 'index.md'), frontmatter + '\n' + mdBody, 'utf-8');
			return res.json({ success: true, slug: slug.trim() });
		} catch (err) {
			console.error('创建文章失败:', err);
			return res.status(500).json({ error: '创建文章失败' });
		}
	}

	if (action === 'postUpdate') {
		if (!slug || typeof slug !== 'string' || !slug.trim()) return res.status(400).json({ error: 'slug 不能为空' });
		const filePath = findPostFile(slug.trim());
		if (!filePath) return res.status(404).json({ error: '未找到文章' });
		try {
			const existing = fs.readFileSync(filePath, 'utf-8');
			const { data: oldData, body: oldBody } = parseFrontmatter(existing);
			const newData = { ...oldData };
			if (title !== undefined) newData.title = String(title).trim();
			if (published !== undefined) newData.published = String(published);
			if (description !== undefined) newData.description = String(description).trim();
			if (tags !== undefined && Array.isArray(tags)) newData.tags = tags;
			if (category !== undefined) newData.category = String(category).trim();
			if (draft !== undefined) newData.draft = draft;
			const frontmatter = buildFrontmatter(newData);
			const mdBody = typeof postBody === 'string' ? postBody : oldBody;
			fs.writeFileSync(filePath, frontmatter + '\n' + mdBody, 'utf-8');
			return res.json({ success: true, slug: slug.trim() });
		} catch (err) {
			console.error('更新文章失败:', err);
			return res.status(500).json({ error: '更新文章失败' });
		}
	}

	if (action === 'postDelete') {
		if (!slug || typeof slug !== 'string' || !slug.trim()) return res.status(400).json({ error: 'slug 不能为空' });
		const postDir = path.join(POSTS_DIR, slug.trim());
		if (!fs.existsSync(postDir)) return res.status(404).json({ error: '未找到文章' });
		try {
			fs.rmSync(postDir, { recursive: true, force: true });
			return res.json({ success: true });
		} catch (err) {
			console.error('删除文章失败:', err);
			return res.status(500).json({ error: '删除文章失败' });
		}
	}

	return res.status(400).json({ error: '未知操作' });
});

// --- Static files ---
app.use(express.static(path.join(__dirname, 'dist', 'client')));

// SPA fallback
app.get('/{*path}', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'client', 'index.html'));
});

const port = 4321;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
