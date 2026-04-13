param()

# dev.ps1 - Launch Backend, Frontend, ngrok tunnel, and Telegram Bot.
#
# Steps:
#   1. Create/check Python venvs for backend and bot, npm for frontend.
#   2. Open [BACKEND] and [FRONTEND] windows.
#   3. Open [NGROK] window (ngrok http 5173).
#   4. Poll http://localhost:4040/api/tunnels until HTTPS URL appears.
#   5. Ask user to confirm or overwrite the URL.
#   6. Write WEB_APP_URL=<url> into bot/.env.
#   7. Open [BOT] window.
#
# Requirements:
#   - Python 3.10+  (python in PATH)
#   - Node.js 18+   (node / npm in PATH)
#   - ngrok         (ngrok in PATH)
#       Install: winget install ngrok
#             OR https://ngrok.com/download
#
# If blocked by execution policy, run once:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Bot      = Join-Path $Root "bot"
$Frontend = Join-Path $Root "frontend"
$BotEnv   = Join-Path $Bot ".env"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step { param($msg) Write-Host ""; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  WARN  $msg" -ForegroundColor Yellow }

function Open-Window {
    param([string]$Title, [string]$WorkDir, [string]$Cmd)
    $script = '$host.UI.RawUI.WindowTitle = ' + "'$Title'" + '; Set-Location ' + "'$WorkDir'" + '; ' + $Cmd
    Start-Process powershell `
        -ArgumentList "-NoExit", "-NoProfile", "-Command", $script `
        -WorkingDirectory $WorkDir
}

# ---------------------------------------------------------------------------
# 1. Backend venv
# ---------------------------------------------------------------------------

Write-Step "Backend: checking venv..."

$BackendVenv = Join-Path $Backend ".venv"
$BackendPip  = Join-Path $BackendVenv "Scripts\pip.exe"

if (-not (Test-Path $BackendVenv)) {
    Write-Step "Backend: creating .venv (~30 sec)..."
    python -m venv $BackendVenv
    & $BackendPip install --quiet -r (Join-Path $Backend "requirements.txt")
    Write-Ok "Backend: dependencies installed."
} else {
    Write-Ok "Backend: .venv found."
}

# ---------------------------------------------------------------------------
# 2. Bot venv
# ---------------------------------------------------------------------------

Write-Step "Bot: checking venv..."

$BotVenv = Join-Path $Bot ".venv"
$BotPip  = Join-Path $BotVenv "Scripts\pip.exe"

if (-not (Test-Path $BotVenv)) {
    Write-Step "Bot: creating .venv (~20 sec)..."
    python -m venv $BotVenv
    & $BotPip install --quiet -r (Join-Path $Bot "requirements.txt")
    Write-Ok "Bot: dependencies installed."
} else {
    Write-Ok "Bot: .venv found."
}

if (-not (Test-Path $BotEnv)) {
    $BotEnvEx = Join-Path $Bot ".env.example"
    if (Test-Path $BotEnvEx) {
        Copy-Item $BotEnvEx $BotEnv
        Write-Warn "bot/.env created from .env.example - fill in BOT_TOKEN."
    }
}

# ---------------------------------------------------------------------------
# 3. Frontend node_modules
# ---------------------------------------------------------------------------

Write-Step "Frontend: checking node_modules..."

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Step "Frontend: running npm install..."
    Push-Location $Frontend
    npm install --silent
    Pop-Location
    Write-Ok "Frontend: dependencies installed."
} else {
    Write-Ok "Frontend: node_modules found."
}

# ---------------------------------------------------------------------------
# 4. Check ngrok
# ---------------------------------------------------------------------------

Write-Step "Checking ngrok..."

$ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue

if ($ngrokCmd) {
    Write-Ok "ngrok found: $($ngrokCmd.Source)"
} else {
    Write-Warn "ngrok not found in PATH."
    Write-Host "     Install: winget install ngrok" -ForegroundColor DarkGray
    Write-Host "     OR: https://ngrok.com/download" -ForegroundColor DarkGray
    Write-Host "     Telegram Mini App requires HTTPS - it will not work on http://localhost." -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------------
# 5. Open Backend and Frontend windows
# ---------------------------------------------------------------------------

Write-Step "Opening Backend and Frontend windows..."

Open-Window "[BACKEND] Aparu API :8000" $Backend `
    "& '.venv\Scripts\activate.ps1'; uvicorn app.main:app --reload --port 8000"
Write-Ok "Backend  -> http://localhost:8000/docs"

Open-Window "[FRONTEND] Aparu Vite :5173" $Frontend "npm run dev"
Write-Ok "Frontend -> http://localhost:5173"

# ---------------------------------------------------------------------------
# 6. ngrok tunnel
# ---------------------------------------------------------------------------

$tunnelUrl = $null

if ($ngrokCmd) {
    Write-Step "Starting ngrok tunnel (port 5173)..."
    Open-Window "[NGROK] Tunnel :5173" $Root "ngrok http 5173"

    Write-Host "  >> Waiting for ngrok" -NoNewline -ForegroundColor Cyan
    $maxWait = 25
    for ($i = 1; $i -le $maxWait; $i++) {
        Start-Sleep 1
        Write-Host "." -NoNewline -ForegroundColor DarkGray
        try {
            $resp = Invoke-RestMethod "http://localhost:4040/api/tunnels" -ErrorAction Stop
            $found = ($resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
            if ($found) {
                $tunnelUrl = $found
                break
            }
        } catch {
            # ngrok not ready yet
        }
    }
    Write-Host ""

    if ($tunnelUrl) {
        Write-Ok "Tunnel detected: $tunnelUrl"
    } else {
        Write-Warn "Could not auto-detect ngrok URL after $maxWait seconds."
        Write-Host "     Make sure ngrok is authenticated: ngrok authtoken <your-token>" -ForegroundColor DarkGray
    }
} else {
    Write-Host ""
    Write-Warn "ngrok not installed - skipping tunnel."
}

# ---------------------------------------------------------------------------
# 7. Confirm tunnel URL
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  ----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "   Mini App URL  (must be HTTPS, reachable by Telegram)" -ForegroundColor White
Write-Host "  ----------------------------------------------------------" -ForegroundColor DarkGray

if ($tunnelUrl) {
    Write-Host "  Auto-detected: " -NoNewline -ForegroundColor DarkGray
    Write-Host $tunnelUrl -ForegroundColor Cyan
    Write-Host ""
    $ans = Read-Host "  Press Enter to use this URL, or paste a different one"
    $ans = $ans.Trim()
    if ($ans -ne "") {
        $tunnelUrl = $ans
    }
} else {
    Write-Host "  Enter the HTTPS tunnel URL (example: https://abc123.ngrok-free.app)" -ForegroundColor DarkGray
    Write-Host "  Press Enter to keep the current WEB_APP_URL from bot/.env" -ForegroundColor DarkGray
    Write-Host ""
    $ans = Read-Host "  URL"
    $ans = $ans.Trim()
    if ($ans -ne "") {
        $tunnelUrl = $ans
    }
}

# ---------------------------------------------------------------------------
# 8. Patch bot/.env
# ---------------------------------------------------------------------------

if ($tunnelUrl) {
    Write-Step "Writing WEB_APP_URL to bot/.env..."

    if (Test-Path $BotEnv) {
        $envRaw = [System.IO.File]::ReadAllText($BotEnv)
        if ($envRaw -match "(?m)^WEB_APP_URL=") {
            $envRaw = [regex]::Replace($envRaw, "(?m)^WEB_APP_URL=.*$", "WEB_APP_URL=$tunnelUrl")
        } else {
            $envRaw = $envRaw.TrimEnd() + "`nWEB_APP_URL=$tunnelUrl`n"
        }
        [System.IO.File]::WriteAllText($BotEnv, $envRaw, [System.Text.Encoding]::UTF8)
        Write-Ok "bot/.env updated: WEB_APP_URL=$tunnelUrl"
    } else {
        $envRaw = "BOT_TOKEN=`nWEB_APP_URL=$tunnelUrl`n"
        [System.IO.File]::WriteAllText($BotEnv, $envRaw, [System.Text.Encoding]::UTF8)
        Write-Warn "bot/.env created - remember to fill in BOT_TOKEN."
    }
} else {
    Write-Warn "No URL provided - bot/.env not changed."
}

# ---------------------------------------------------------------------------
# 9. Launch bot
# ---------------------------------------------------------------------------

Write-Step "Checking BOT_TOKEN and launching bot..."

$botEnvRaw = ""
if (Test-Path $BotEnv) {
    $botEnvRaw = [System.IO.File]::ReadAllText($BotEnv)
}

if ($botEnvRaw -match "BOT_TOKEN=\d") {
    Open-Window "[BOT] Aparu Telegram Bot" $Bot `
        "& '.venv\Scripts\activate.ps1'; python main.py"
    Write-Ok "Bot window opened."
} else {
    Write-Warn "BOT_TOKEN not set in bot/.env - bot window skipped."
    Write-Warn "Set the token and re-run dev.ps1."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  ==========================================================" -ForegroundColor DarkGray
Write-Host "   Running:" -ForegroundColor Green
Write-Host "    Backend    ->  http://localhost:8000/docs"
Write-Host "    Frontend   ->  http://localhost:5173"
if ($tunnelUrl) {
    Write-Host "    Mini App   ->  $tunnelUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Share with Telegram:" -ForegroundColor DarkGray
    Write-Host "    Set Menu Button in @BotFather -> Edit Bot -> Bot Menu Button" -ForegroundColor DarkGray
}
Write-Host "  ==========================================================" -ForegroundColor DarkGray
Write-Host ""
