$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$projectRoot = $env:DOCS_PREVIEW_ROOT
if (-not $projectRoot) { $projectRoot = $PSScriptRoot }

try {
    # 双击入口不依赖终端当前目录，始终使用本项目的文档目录。
    Set-Location -LiteralPath (Join-Path $projectRoot 'docs')

    # 优先使用系统环境；也兼容这台电脑已安装的 Codex 本地运行时。
    $runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $nodeDir = Join-Path $runtimeRoot 'node\bin'
        if (Test-Path -LiteralPath (Join-Path $nodeDir 'node.exe')) {
            $env:PATH = "$nodeDir;$env:PATH"
        }
    }
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if (-not $pnpmCommand) {
        $fallback = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
        if (Test-Path -LiteralPath $fallback) { $pnpmPath = $fallback }
        else { throw '未找到 pnpm，请安装 pnpm 后重新启动。' }
    } else { $pnpmPath = $pnpmCommand.Source }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw '未找到 Node.js，请安装 Node.js 后重新启动。'
    }

    # 固定端口被占用时立即说明原因，不静默切换地址。
    $listener = Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        throw '端口 5174 已被占用。若预览已启动，请访问 http://127.0.0.1:5174/docs/；否则先关闭占用端口的程序。'
    }

    Write-Host '正在同步文档站依赖，首次启动可能需要稍等……'
    & $pnpmPath install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请检查上方错误和网络连接。' }

    Write-Host '预览地址：http://127.0.0.1:5174/docs/'
    Write-Host '保存文档后浏览器自动更新。按 Ctrl+C 或关闭此窗口可停止预览。'
    # 直接调用入口，避免部分 Windows pnpm 环境无法解析命令垫片。
    & node 'node_modules/vitepress/bin/vitepress.js' dev --host 127.0.0.1 --port 5174 --strictPort --open /docs/
    if ($LASTEXITCODE -ne 0) { throw '文档预览启动失败，请检查上方错误。' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
