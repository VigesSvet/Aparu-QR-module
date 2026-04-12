param()

# dev.ps1 - starts backend, bot and frontend in separate PowerShell windows
# If blocked by execution policy, run once:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Bot      = Join-Path $Root "bot"
$Frontend = Join-Path $Root "frontend"

function Print-Step { param($msg); Write-Host ""; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Print-Ok   { param($msg); Write-Host "  OK  $msg" -ForegroundColor Green }
function Print-Warn { param($msg); Write-Host "  WARN  $msg" -ForegroundColor Yellow }

function Open-Window {
    param($Title, $WorkDir, $Cmd)
    $script = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Cmd"
    Start-Process powershell `
        -ArgumentList "-NoExit", "-NoProfile", "-Command", $script `
        -WorkingDirectory $WorkDir
}

# --- Backend venv ---

Print-Step "Backend: checking venv..."

$BackendVenv = Join-Path $Backend ".venv"
$BackendPip  = Join-Path $BackendVenv "Scripts\pip.exe"

if (-not (Test-Path $BackendVenv)) {
    Print-Step "Backend: creating .venv (~30 sec)..."
    python -m venv $BackendVenv
    & $BackendPip install --quiet -r (Join-Path $Backend "requirements.txt")
    Print-Ok "Backend: dependencies installed."
} else {
    Print-Ok "Backend: .venv exists, skipping."
}

# --- Bot venv ---

Print-Step "Bot: checking venv..."

$BotVenv = Join-Path $Bot ".venv"
$BotPip  = Join-Path $BotVenv "Scripts\pip.exe"

if (-not (Test-Path $BotVenv)) {
    Print-Step "Bot: creating .venv (~20 sec)..."
    python -m venv $BotVenv
    & $BotPip install --quiet -r (Join-Path $Bot "requirements.txt")
    Print-Ok "Bot: dependencies installed."
} else {
    Print-Ok "Bot: .venv exists, skipping."
}

$BotEnv   = Join-Path $Bot ".env"
$BotEnvEx = Join-Path $Bot ".env.example"

if (-not (Test-Path $BotEnv)) {
    Copy-Item $BotEnvEx $BotEnv
    Print-Warn "bot/.env created from .env.example"
    Print-Warn "Fill in BOT_TOKEN in bot/.env, then re-run this script."
    Print-Warn "Other services will start without the bot for now."
}

# --- Frontend node_modules ---

Print-Step "Frontend: checking node_modules..."

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Print-Step "Frontend: running npm install..."
    Push-Location $Frontend
    npm install --silent
    Pop-Location
    Print-Ok "Frontend: dependencies installed."
} else {
    Print-Ok "Frontend: node_modules exists, skipping."
}

# --- Launch windows ---

Print-Step "Opening service windows..."

Open-Window "[BACKEND] Aparu API :8000" $Backend `
    "& '.venv\Scripts\activate.ps1'; uvicorn app.main:app --reload --port 8000"

$botEnvContent = Get-Content $BotEnv -Raw -ErrorAction SilentlyContinue
if ($botEnvContent -match 'BOT_TOKEN=\d') {
    Open-Window "[BOT] Aparu Telegram Bot" $Bot `
        "& '.venv\Scripts\activate.ps1'; python main.py"
    Print-Ok "Bot: window opened."
} else {
    Print-Warn "Bot: BOT_TOKEN not set - skipping bot window."
    Print-Warn "Edit bot/.env and re-run to start the bot."
}

Open-Window "[FRONTEND] Aparu Vite :5173" $Frontend "npm run dev"

Write-Host ""
Write-Host "  Done! Windows opened:" -ForegroundColor Green
Write-Host "    Backend  -> http://localhost:8000/docs"
Write-Host "    Frontend -> http://localhost:5173"
Write-Host ""
