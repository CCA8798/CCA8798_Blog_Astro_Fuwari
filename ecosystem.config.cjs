module.exports = {
  apps: [
    {
      name: 'blog',
      script: 'start.ps1',
      cwd: 'F:/Web/Nodejs/Projects/CCA8798_Blog_Astro_Fuwari',
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
