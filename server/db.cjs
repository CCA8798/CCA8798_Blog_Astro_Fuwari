const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "data", "blog.db");

let db = null;

async function getDb() {
	if (db) return db;

	const SQL = await initSqlJs();

	if (fs.existsSync(DB_PATH)) {
		const buffer = fs.readFileSync(DB_PATH);
		db = new SQL.Database(buffer);
	} else {
		const dir = path.dirname(DB_PATH);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		db = new SQL.Database();
	}

	initSchema(db);
	saveDb();

	await ensureAdminUser();

	return db;
}

async function ensureAdminUser() {
	const adminUser = await getUserByUsername("CCA8798");
	if (!adminUser) {
		const hashedPassword = await bcrypt.hash("lin20120103", 10);
		await createUser("CCA8798", hashedPassword, "不会起名の捌拐玖捌🍥", "admin");
	}
}

function initSchema(db) {
	db.run(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL DEFAULT 'user',
			created_at TEXT DEFAULT (datetime('now'))
		)
	`);
}

function saveDb() {
	const data = db.export();
	const buffer = Buffer.from(data);
	fs.writeFileSync(DB_PATH, buffer);
}

const userDb = {
	async createUser(username, hashedPassword, displayName, role = "user") {
		const d = await getDb();
		const stmt = d.prepare(
			"INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)"
		);
		stmt.bind([username, hashedPassword, displayName || username, role]);
		stmt.step();
		stmt.free();
		saveDb();
	},

	async getUserByUsername(username) {
		const d = await getDb();
		const stmt = d.prepare("SELECT * FROM users WHERE username = ?");
		stmt.bind([username]);
		if (stmt.step()) {
			const row = stmt.getAsObject();
			stmt.free();
			return row;
		}
		stmt.free();
		return null;
	},

	async getUserById(id) {
		const d = await getDb();
		const stmt = d.prepare("SELECT id, username, display_name, role, created_at FROM users WHERE id = ?");
		stmt.bind([id]);
		if (stmt.step()) {
			const row = stmt.getAsObject();
			stmt.free();
			return row;
		}
		stmt.free();
		return null;
	},

	async getAllUsers() {
		const d = await getDb();
		const stmt = d.prepare("SELECT id, username, display_name, role, created_at FROM users ORDER BY id DESC");
		const users = [];
		while (stmt.step()) {
			users.push(stmt.getAsObject());
		}
		stmt.free();
		return users;
	},

	async updateUserRole(id, role) {
		const d = await getDb();
		d.run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
		saveDb();
	},

	async deleteUser(id) {
		const d = await getDb();
		d.run("DELETE FROM users WHERE id = ?", [id]);
		saveDb();
	},
};

module.exports = { userDb, getDb };
