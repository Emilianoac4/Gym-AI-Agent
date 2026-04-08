param(
  [string]$Url = "https://admin.tucofitness.com"
)

$requiredHeaders = @(
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "strict-transport-security",
  "referrer-policy",
  "permissions-policy"
)

Write-Host "Validando headers de seguridad en: $Url"

$response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing
$headers = $response.Headers

$present = @()
$missing = @()

foreach ($header in $requiredHeaders) {
  if ($headers[$header]) {
    $present += "${header}: $($headers[$header])"
  } else {
    $missing += $header
  }
}

Write-Host ""
Write-Host "Headers presentes:"
if ($present.Count -eq 0) {
  Write-Host "- Ninguno"
} else {
  $present | ForEach-Object { Write-Host "- $_" }
}

Write-Host ""
Write-Host "Headers faltantes:"
if ($missing.Count -eq 0) {
  Write-Host "- Ninguno"
  Write-Host ""
  Write-Host "Resultado: PASS"
  exit 0
} else {
  $missing | ForEach-Object { Write-Host "- $_" }
  Write-Host ""
  Write-Host "Resultado: FAIL"
  exit 1
}
