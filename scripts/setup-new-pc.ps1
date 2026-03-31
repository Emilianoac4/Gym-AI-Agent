param(
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Write-Host "[1/6] Checking Node.js..." -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed. Install Node 20+ first."
}

Write-Host "[2/6] Installing backend dependencies..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\backend"
npm install
Pop-Location

Write-Host "[3/6] Installing mobile dependencies..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\mobile"
npm install
Pop-Location

Write-Host "[4/6] Creating .env files if missing..." -ForegroundColor Cyan
if (-not (Test-Path "$ProjectRoot\backend\.env")) {
  Copy-Item "$ProjectRoot\backend\.env.example" "$ProjectRoot\backend\.env"
  Write-Host "Created backend/.env from example" -ForegroundColor Yellow
}
if (-not (Test-Path "$ProjectRoot\mobile\.env")) {
  Copy-Item "$ProjectRoot\mobile\.env.example" "$ProjectRoot\mobile\.env"
  Write-Host "Created mobile/.env from example" -ForegroundColor Yellow
}

Write-Host "[5/6] Running typecheck..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\backend"
npm run typecheck
Pop-Location
Push-Location "$ProjectRoot\mobile"
npm run typecheck
Pop-Location

Write-Host "[6/6] Done." -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Green
Write-Host "  1) Fill backend/.env (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY)"
Write-Host "  2) Fill mobile/.env (EXPO_PUBLIC_API_BASE_URL=http://<your-ip>:3000)"
Write-Host "  3) Start backend: cd backend; npm run dev"
Write-Host "  4) Start mobile: cd mobile; npm run start"
