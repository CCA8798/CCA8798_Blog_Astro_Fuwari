# ============================================================
# start.ps1 - CCA8798 Blog 生产服务器启动 + 自动部署脚本
#
# 功能:
#   1. 设置 STATUS_TOKEN 并启动 server.cjs (Express)
#   2. 自动部署: 定期检测 GitHub master 推送, 有更新则自动
#      pull + build + 重启服务
#
# 用法:
#   .\start.ps1 -Token "your-secret-token"                    # 带自动部署(默认60s轮询)
#   .\start.ps1 -Token "xxx" -PollInterval 30                 # 30秒轮询一次
#   .\start.ps1 -Token "xxx" -NoAutoDeploy                    # 仅启动, 不自动部署
#   .\start.ps1 -Token "xxx" -Proxy "http://127.0.0.1:7897"   # GitHub 走代理
#
# 日志: logs/server.log (服务器输出), logs/deploy.log (部署记录), logs/build.log (构建输出)
# ============================================================

param(
    [string]$Token = "",
    [int]$PollInterval = 60,
    [switch]$NoAutoDeploy,
    [string]$Proxy = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

# ------------------------------------------------------------
# 环境检查
# ------------------------------------------------------------
foreach ($cmd in @("node", "git", "pnpm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] 未找到 $cmd, 请先安装并加入 PATH" -ForegroundColor Red
        exit 1
    }
}

# ------------------------------------------------------------
# 日志
# ------------------------------------------------------------
$LogDir = Join-Path $Root "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$ServerLog = Join-Path $LogDir "server.log"
$ServerErrLog = Join-Path $LogDir "server-error.log"
$DeployLog = Join-Path $LogDir "deploy.log"
$BuildLog = Join-Path $LogDir "build.log"

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path $DeployLog -Value $line -Encoding UTF8
}

# ------------------------------------------------------------
# STATUS_TOKEN
# ------------------------------------------------------------
if ($Token) {
    $env:STATUS_TOKEN = $Token
} elseif (-not $env:STATUS_TOKEN) {
    Write-Host "[WARN] 未设置 STATUS_TOKEN (参数 -Token 或环境变量), 任何人可修改状态栏!" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 代理 (git 拉取用)
# ------------------------------------------------------------
if ($Proxy) {
    Write-Log "设置 Git 代理: $Proxy"
    git config http.proxy $Proxy
    git config https.proxy $Proxy
    $env:HTTP_PROXY = $Proxy
    $env:HTTPS_PROXY = $Proxy
}

# ------------------------------------------------------------
# 服务器进程管理
# ------------------------------------------------------------
$script:ServerPid = $null

function Start-Server {
    Write-Log "启动 server.cjs (端口 4321)..."
    $proc = Start-Process -FilePath "node" -ArgumentList "server.cjs" `
        -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $ServerLog -RedirectStandardError $ServerErrLog
    $script:ServerPid = $proc.Id
    Start-Sleep -Seconds 2
    if (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue) {
        Write-Log "服务器已启动, PID=$($proc.Id), 访问 http://localhost:4321"
    } else {
        Write-Log "[ERROR] 服务器启动失败! 查看 logs/server.log"
    }
}

function Stop-Server {
    if ($script:ServerPid -and (Get-Process -Id $script:ServerPid -ErrorAction SilentlyContinue)) {
        Write-Log "停止服务器 (PID=$script:ServerPid)..."
        Stop-Process -Id $script:ServerPid -Force
        Start-Sleep -Seconds 1
        $script:ServerPid = $null
    }
}

# ------------------------------------------------------------
# Git 远程检测
# ------------------------------------------------------------
function Get-RemoteHead {
    try {
        $out = git ls-remote origin master 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return ($out -split "\s+")[0]
    } catch {
        return $null
    }
}

function Get-LocalHead {
    try {
        return (git rev-parse HEAD).Trim()
    } catch {
        return $null
    }
}

# ------------------------------------------------------------
# 部署流程 (pull + build + 重启)
# ------------------------------------------------------------
function Invoke-Deploy {
    param([string]$OldSha)

    $newSha = Get-LocalHead
    Write-Log "检测到 master 新推送 ($OldSha -> $newSha)"
    Stop-Server

    # 备份当前构建产物 (build 失败时回滚)
    $dist = Join-Path $Root "dist"
    $distBackup = Join-Path $Root "dist-backup"
    if (Test-Path $distBackup) { Remove-Item $distBackup -Recurse -Force }
    if (Test-Path $dist) { Copy-Item $dist $distBackup -Recurse -Force }

    # 保护本地未提交修改 (status.json 等已被 gitignore, 主要是 list.json / 文章)
    $dirty = git status --porcelain --untracked-files=no 2>$null
    $stashed = $false
    if ($dirty) {
        $dirtyList = ($dirty | ForEach-Object { $_.Trim() }) -join ", "
        Write-Log "本地有未提交修改, 暂存: $dirtyList"
        git stash push -m "auto-deploy-$(Get-Date -Format yyyyMMddHHmmss)"
        $stashed = ($LASTEXITCODE -eq 0)
    }

    # 拉取
    git fetch origin master
    $fetchOk = ($LASTEXITCODE -eq 0)
    if ($fetchOk) {
        git reset --hard origin/master
        $fetchOk = ($LASTEXITCODE -eq 0)
    }

    # 恢复本地修改
    if ($stashed) {
        try { git stash pop } catch { Write-Log "[WARN] 暂存恢复失败, 请手动处理 git stash list" }
    }

    if (-not $fetchOk) {
        Write-Log "[ERROR] git 拉取失败, 回滚构建产物并重启旧版本"
        if (Test-Path $distBackup) {
            if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
            Move-Item $distBackup $dist
        }
        Start-Server
        return
    }

    # 依赖变更检测 (package.json / pnpm-lock.yaml)
    $depsChanged = git diff --name-only "$OldSha..HEAD" -- package.json pnpm-lock.yaml 2>$null
    if ($depsChanged) {
        Write-Log "依赖有变更, 执行 pnpm install"
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            Write-Log "[ERROR] pnpm install 失败, 跳过本次部署"
            if (Test-Path $distBackup) {
                if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
                Move-Item $distBackup $dist
            }
            Start-Server
            return
        }
    }

    # 构建
    Write-Log "执行 pnpm build ..."
    pnpm build *>> $BuildLog
    if ($LASTEXITCODE -ne 0) {
        Write-Log "[ERROR] pnpm build 失败, 回滚到旧构建产物"
        if (Test-Path $distBackup) {
            if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
            Move-Item $distBackup $dist
        }
    } else {
        Write-Log "构建成功"
    }

    if (Test-Path $distBackup) { Remove-Item $distBackup -Recurse -Force }
    Start-Server
}

# ------------------------------------------------------------
# 主流程
# ------------------------------------------------------------
Write-Log "===== CCA8798 Blog 启动脚本 ====="
Write-Log "目录: $Root"
Write-Log "自动部署: $(-not $NoAutoDeploy) (轮询间隔 ${PollInterval}s)"

Start-Server

if ($NoAutoDeploy) {
    Write-Log "自动部署已禁用, 仅运行服务器 (Ctrl+C 退出)"
    while ($true) { Start-Sleep -Seconds 60 }
    exit 0
}

# 自动部署循环
$lastSha = Get-LocalHead
Write-Log "当前本地版本: $lastSha"

while ($true) {
    Start-Sleep -Seconds $PollInterval
    $remoteSha = Get-RemoteHead
    if (-not $remoteSha) {
        Write-Log "[WARN] 无法获取远程版本 (网络/代理?), 跳过本轮检测"
        continue
    }
    $localSha = Get-LocalHead
    if ($remoteSha -ne $localSha) {
        Invoke-Deploy -OldSha $localSha
        $lastSha = $remoteSha
    } else {
        # 服务器意外退出则自动拉起
        if (-not (Get-Process -Id $script:ServerPid -ErrorAction SilentlyContinue)) {
            Write-Log "[WARN] 服务器进程已退出, 自动重启"
            Start-Server
        }
    }
}
