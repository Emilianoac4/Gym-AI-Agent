#!/usr/bin/env powershell
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Identifier = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=== Block 1 + AI Cross Validation ===" -ForegroundColor Cyan

Write-Host "`n[1/2] Running Block 1 integrity test" -ForegroundColor Yellow
npm test -- --runInBand tests/security/user-delete-financial-integrity.test.ts
if ($LASTEXITCODE -ne 0) {
  throw "Block 1 integrity test failed"
}

Write-Host "`n[2/2] Running AI local iteration validation" -ForegroundColor Yellow
$aiArgs = @("-ExecutionPolicy", "Bypass", "-File", "./scripts/ai-iteration-validation.ps1", "-BaseUrl", $BaseUrl)
if (-not [string]::IsNullOrWhiteSpace($Identifier)) {
  $aiArgs += @("-Identifier", $Identifier)
}
if (-not [string]::IsNullOrWhiteSpace($Password)) {
  $aiArgs += @("-Password", $Password)
}

powershell @aiArgs
if ($LASTEXITCODE -ne 0) {
  throw "AI local iteration validation failed"
}

Write-Host "`n=== CROSS VALIDATION PASSED ===" -ForegroundColor Green
