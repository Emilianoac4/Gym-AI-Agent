param(
  [string]$ProjectRoot = "c:\APPS_EAC\Agente_Gym",
  [string]$OutputZip = "c:\APPS_EAC\Agente_Gym_migration.zip"
)

$ErrorActionPreference = "Stop"

$staging = Join-Path $env:TEMP "Agente_Gym_migration_staging"
if (Test-Path $staging) {
  Remove-Item -Recurse -Force $staging
}
New-Item -ItemType Directory -Path $staging | Out-Null

Write-Host "Copying files to staging..." -ForegroundColor Cyan
robocopy $ProjectRoot $staging /E /XD node_modules .git .expo dist /XF .env dbpush.log *.log > $null

if (Test-Path $OutputZip) {
  Remove-Item -Force $OutputZip
}

Write-Host "Creating zip: $OutputZip" -ForegroundColor Cyan
Compress-Archive -Path "$staging\*" -DestinationPath $OutputZip -Force

Write-Host "Done. Zip ready at: $OutputZip" -ForegroundColor Green
Write-Host "Note: .env files are excluded by design." -ForegroundColor Yellow
