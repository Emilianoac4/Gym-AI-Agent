param(
  [string]$ProjectRoot = "c:\APPS_EAC\Agente_Gym"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking backend health..." -ForegroundColor Cyan
$health = Invoke-RestMethod "http://localhost:3000/health"
if (-not $health.ok) {
  throw "Backend health check failed"
}
Write-Host "Backend OK" -ForegroundColor Green

Write-Host "Checking mobile env..." -ForegroundColor Cyan
$mobileEnv = Get-Content "$ProjectRoot\mobile\.env" -ErrorAction Stop
if ($mobileEnv -notmatch "EXPO_PUBLIC_API_BASE_URL=http://") {
  throw "mobile/.env missing EXPO_PUBLIC_API_BASE_URL"
}
Write-Host "Mobile env OK" -ForegroundColor Green

Write-Host "Post-migration checks passed." -ForegroundColor Green
