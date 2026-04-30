const express = require('express');
const path = require('path');
const app = express();

// 托管 dist 目录下的所有静态文件
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/status.json', (req, res) => {
    try {
        const jsonPath = path.join(__dirname, 'list.json'); // 与 server.cjs 同目录
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        const jsonData = JSON.parse(rawData);
        res.json(jsonData);  // 自动设 Content-Type: application/json
    } catch (err) {
        console.error('读取 list.json 失败:', err);
        res.status(500).json({ error: 'Failed to load data' });
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