const express = require('express');
const path = require('path');
const app = express();

// 托管 dist 目录下的所有静态文件
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 回退：所有非静态文件请求都返回 index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = 4321;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});