// 动态定位项目根目录（ecosystem.config.cjs 所在目录），
// 避免硬编码路径导致服务器上 Script not found
const PROJECT_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'blog',
      script: require('path').join(PROJECT_DIR, 'start.ps1'),
      cwd: PROJECT_DIR,
      // Windows: pm2 无法直接以 powershell 作为 interpreter 启动 .ps1
      // （会立即退出且无日志）。改用 cmd /c 包装：
      //   cmd /c powershell -NoProfile -ExecutionPolicy Bypass -File start.ps1
      interpreter: 'cmd',
      interpreter_args: '/c powershell -NoProfile -ExecutionPolicy Bypass -File',
      args: '-Token test123 -NoAutoDeploy',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
      windowsHide: true,
      env: {
        STATUS_TOKEN: 'test123',
      },
    },
  ],
};
