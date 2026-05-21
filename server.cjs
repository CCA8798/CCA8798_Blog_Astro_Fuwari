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

// 状态 API：GET /api/status → 读取；GET /api/status?text=xxx&token=yyy → 更新
app.get('/api/status', (req, res) => {
    const textParam = req.query.text;

    // 更新模式
    if (textParam !== undefined) {
        const token = process.env.STATUS_TOKEN;
        if (token && req.query.token !== token) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const text = String(textParam).trim();
        const status = { text, updatedAt: new Date().toISOString() };

        try {
            fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
            return res.json({ success: true, status });
        } catch (err) {
            console.error('写入 status.json 失败:', err);
            return res.status(500).json({ error: 'Failed to save status' });
        }
    }

    // 读取模式
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

// 兼容旧版：/api/status/update?text=xxx&token=yyy
app.get('/api/status/update', (req, res) => {
    res.redirect(301, '/api/status?' + new URLSearchParams(req.query).toString());
});

// SPA 回退：所有非静态文件请求都返回 index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = 4321;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});