const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const STATUS_FILE = path.join(__dirname, 'status.json');

// 托管 dist 目录下的所有静态文件
app.use(express.static(path.join(__dirname, 'dist')));

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

// 获取当前状态
app.get('/api/status', (_req, res) => {
    try {
        let status = { text: '', updatedAt: null };
        if (fs.existsSync(STATUS_FILE)) {
            status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
        }
        res.json(status);
    } catch (err) {
        console.error('读取 status.json 失败:', err);
        res.status(500).json({ error: 'Failed to load status' });
    }
});

// 更新状态 (GET 方便浏览器直接访问)
// 用法: /api/status/update?text=xxx&token=xxx
app.get('/api/status/update', (req, res) => {
    const token = process.env.STATUS_TOKEN;
    if (token && req.query.token !== token) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const text = String(req.query.text || '').trim();
    const status = { text, updatedAt: new Date().toISOString() };

    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
        res.json({ success: true, status });
    } catch (err) {
        console.error('写入 status.json 失败:', err);
        res.status(500).json({ error: 'Failed to save status' });
    }
});

// SPA 回退：所有非静态文件请求都返回 index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = 4321;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});