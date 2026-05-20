const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { userDb } = require("./server/db.cjs");

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || "cca8798-blog-jwt-secret-2026";
const JWT_EXPIRES = "7d";

app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

app.get("/api/status.json", (req, res) => {
	try {
		const jsonPath = path.join(__dirname, "list.json");
		const rawData = fs.readFileSync(jsonPath, "utf-8");
		const jsonData = JSON.parse(rawData);
		res.json(jsonData);
	} catch (err) {
		console.error("读取 list.json 失败:", err);
		res.status(500).json({ error: "Failed to load data" });
	}
});

/* ===== Auth API ===== */

function authMiddleware(req, res, next) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith("Bearer ")) {
		return res.status(401).json({ error: "未登录" });
	}
	try {
		const token = header.slice(7);
		const decoded = jwt.verify(token, JWT_SECRET);
		req.user = decoded;
		next();
	} catch {
		return res.status(401).json({ error: "登录已过期，请重新登录" });
	}
}

// 注册
app.post("/api/auth/register", async (req, res) => {
	try {
		const { username, password, displayName } = req.body;

		if (!username || !password) {
			return res.status(400).json({ error: "用户名和密码不能为空" });
		}

		if (typeof username !== "string" || typeof password !== "string") {
			return res.status(400).json({ error: "参数类型错误" });
		}

		const usernameTrimmed = username.trim();
		if (usernameTrimmed.length < 2 || usernameTrimmed.length > 20) {
			return res.status(400).json({ error: "用户名长度需在 2-20 个字符之间" });
		}

		if (password.length < 6) {
			return res.status(400).json({ error: "密码长度不能少于 6 位" });
		}

		const existing = await userDb.getUserByUsername(usernameTrimmed);
		if (existing) {
			return res.status(409).json({ error: "用户名已存在" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		await userDb.createUser(usernameTrimmed, hashedPassword, displayName || usernameTrimmed, "user");

		const user = await userDb.getUserByUsername(usernameTrimmed);
		const token = jwt.sign(
			{ id: user.id, username: user.username, display_name: user.display_name, role: user.role },
			JWT_SECRET,
			{ expiresIn: JWT_EXPIRES },
		);

		res.json({
			token,
			user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
		});
	} catch (err) {
		console.error("注册失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

// 登录
app.post("/api/auth/login", async (req, res) => {
	try {
		const { username, password } = req.body;

		if (!username || !password) {
			return res.status(400).json({ error: "用户名和密码不能为空" });
		}

		if (typeof username !== "string" || typeof password !== "string") {
			return res.status(400).json({ error: "参数类型错误" });
		}

		const user = await userDb.getUserByUsername(username.trim());
		if (!user) {
			return res.status(401).json({ error: "用户名或密码错误" });
		}

		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			return res.status(401).json({ error: "用户名或密码错误" });
		}

		const token = jwt.sign(
			{ id: user.id, username: user.username, display_name: user.display_name, role: user.role },
			JWT_SECRET,
			{ expiresIn: JWT_EXPIRES },
		);

		res.json({
			token,
			user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role },
		});
	} catch (err) {
		console.error("登录失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

// 获取当前用户信息
app.get("/api/auth/me", authMiddleware, async (req, res) => {
	try {
		const user = await userDb.getUserById(req.user.id);
		if (!user) {
			return res.status(404).json({ error: "用户不存在" });
		}
		res.json({ user });
	} catch (err) {
		console.error("获取用户信息失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

/* ===== Admin API ===== */

function adminMiddleware(req, res, next) {
	const header = req.headers.authorization;
	if (!header || !header.startsWith("Bearer ")) {
		return res.status(401).json({ error: "未登录" });
	}
	try {
		const token = header.slice(7);
		const decoded = jwt.verify(token, JWT_SECRET);
		if (decoded.role !== "admin") {
			return res.status(403).json({ error: "权限不足，仅管理员可访问" });
		}
		req.user = decoded;
		next();
	} catch {
		return res.status(401).json({ error: "登录已过期，请重新登录" });
	}
}

app.get("/api/admin/users", adminMiddleware, async (req, res) => {
	try {
		const users = await userDb.getAllUsers();
		res.json({ users });
	} catch (err) {
		console.error("获取用户列表失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

app.put("/api/admin/users/:id/role", adminMiddleware, async (req, res) => {
	try {
		const { id } = req.params;
		const { role } = req.body;
		if (role !== "admin" && role !== "user") {
			return res.status(400).json({ error: "无效的角色" });
		}
		await userDb.updateUserRole(parseInt(id), role);
		res.json({ success: true });
	} catch (err) {
		console.error("更新用户角色失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

app.delete("/api/admin/users/:id", adminMiddleware, async (req, res) => {
	try {
		const { id } = req.params;
		if (parseInt(id) === req.user.id) {
			return res.status(400).json({ error: "不能删除自己的账号" });
		}
		await userDb.deleteUser(parseInt(id));
		res.json({ success: true });
	} catch (err) {
		console.error("删除用户失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

app.get("/api/admin/posts", adminMiddleware, async (req, res) => {
	try {
		const postsPath = path.join(__dirname, "dist", "posts");
		const posts = [];
		if (fs.existsSync(postsPath)) {
			const entries = fs.readdirSync(postsPath);
			for (const entry of entries) {
				const indexPath = path.join(postsPath, entry, "index.html");
				if (fs.existsSync(indexPath)) {
					posts.push({ slug: entry });
				}
			}
		}
		res.json({ posts });
	} catch (err) {
		console.error("获取文章列表失败:", err);
		res.status(500).json({ error: "服务器内部错误" });
	}
});

// SPA fallback
app.get("/{*path}", (req, res) => {
	res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
