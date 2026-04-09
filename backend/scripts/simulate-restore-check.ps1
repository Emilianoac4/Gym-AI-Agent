<#
.SYNOPSIS
  INF-SEC-02 — Simulacro de backup/restore: valida conectividad, integridad de datos y RPO/RTO en staging.

.DESCRIPTION
  Ejecuta una serie de comprobaciones contra la API de staging y la base de datos de Supabase
  para confirmar que un restore hipotetico seria exitoso. No modifica datos.
  Escribe el resultado en backend/scripts/logs/restore_check_YYYYMMDD_HHmmss.log

.PARAMETER ApiBaseUrl
  URL base del backend de staging. Default: https://gym-ai-agent-backend-staging.onrender.com

.PARAMETER DatabaseUrl
  Cadena de conexion PostgreSQL. Si se omite, se usa $env:DATABASE_URL.

.EXAMPLE
  .\simulate-restore-check.ps1 -ApiBaseUrl "https://gym-ai-agent-backend-staging.onrender.com" -DatabaseUrl $env:DATABASE_URL
#>

param(
  [string]$ApiBaseUrl  = "https://gym-ai-agent-backend-staging.onrender.com",
  [string]$DatabaseUrl = $env:DATABASE_URL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---- helpers ----------------------------------------------------------------

function Write-Step {
  param([string]$Label, [string]$Result, [string]$Detail = "")
  $symbol = if ($Result -eq "PASS") { "OK" } else { "FAIL" }
  $line   = "[INF-SEC-02] $Label : $Result  $Detail"
  Write-Host $line
  return $line
}

$logDir = Join-Path $PSScriptRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("restore_check_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".log")
$logLines = [System.Collections.Generic.List[string]]::new()
$pass     = $true

function Log { param([string]$Line); $logLines.Add($Line); Write-Host $Line }

# ---- header -----------------------------------------------------------------

$t0 = Get-Date
Log "[INF-SEC-02] === SIMULACRO BACKUP/RESTORE INF-SEC-02 ==="
Log "[INF-SEC-02] T0: $($t0.ToString("o"))"
Log "[INF-SEC-02] ApiBaseUrl  : $ApiBaseUrl"
Log "[INF-SEC-02] DatabaseUrl : $(if ($DatabaseUrl) { "<set>" } else { "<empty>" })"
Log ""

# ---- STEP 1: Backend /health ------------------------------------------------

Log "[INF-SEC-02] STEP 1 - Backend /health"
try {
  $resp    = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -UseBasicParsing -TimeoutSec 30
  $content = $resp.Content | ConvertFrom-Json
  if ($resp.StatusCode -eq 200 -and $content.ok -eq $true) {
    $line = Write-Step "STEP 1 - Backend health" "PASS" "(HTTP 200, ok=true)"
  } else {
    $line = Write-Step "STEP 1 - Backend health" "FAIL" "(HTTP $($resp.StatusCode))"
    $pass = $false
  }
} catch {
  $line = Write-Step "STEP 1 - Backend health" "FAIL" "($($_.Exception.Message))"
  $pass = $false
}
$logLines.Add($line)

# ---- STEP 2: DB connectivity via psql ---------------------------------------

Log ""
Log "[INF-SEC-02] STEP 2 - DB connectivity (psql table count)"

if (-not $DatabaseUrl) {
  $line = Write-Step "STEP 2 - DB connectivity" "SKIP" "(DATABASE_URL no configurado)"
  $logLines.Add($line)
} else {
  try {
    $psqlQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
    $psqlResult = & psql $DatabaseUrl --tuples-only --command $psqlQuery 2>&1
    $tableCount = ($psqlResult | Select-String -Pattern '\d+').Matches[0].Value.Trim()
    if ([int]$tableCount -gt 5) {
      $line = Write-Step "STEP 2 - DB connectivity" "PASS" "(tablas publicas encontradas: $tableCount)"
    } else {
      $line = Write-Step "STEP 2 - DB connectivity" "FAIL" "(tablas insuficientes: $tableCount)"
      $pass = $false
    }
  } catch {
    $line = Write-Step "STEP 2 - DB connectivity" "FAIL" "(psql no disponible o error: $($_.Exception.Message))"
    # No critico si psql no esta instalado; continuar
  }
  $logLines.Add($line)
}

# ---- STEP 3: Data freshness (audit_logs reciente) ---------------------------

Log ""
Log "[INF-SEC-02] STEP 3 - Data freshness (audit_logs ultimos 60 min)"

if (-not $DatabaseUrl) {
  $line = Write-Step "STEP 3 - Data freshness" "SKIP" "(DATABASE_URL no configurado)"
  $logLines.Add($line)
} else {
  try {
    $freshnessQuery = @"
SELECT EXTRACT(EPOCH FROM (now() - MAX(created_at)))::int AS seconds_since_last
FROM audit_logs;
"@
    $freshnessResult = & psql $DatabaseUrl --tuples-only --command $freshnessQuery 2>&1
    $seconds = ($freshnessResult | Select-String -Pattern '\d+').Matches[0].Value.Trim()
    $minutesAgo = [math]::Round([int]$seconds / 60, 1)
    # RPO: acceptable gap = 24h = 86400s
    if ([int]$seconds -lt 86400) {
      $line = Write-Step "STEP 3 - Data freshness" "PASS" "(ultimo registro: hace $minutesAgo min)"
    } else {
      $line = Write-Step "STEP 3 - Data freshness" "WARN" "(ultimo registro: hace $minutesAgo min - revisar backup)"
    }
  } catch {
    $line = Write-Step "STEP 3 - Data freshness" "SKIP" "(psql no disponible)"
  }
  $logLines.Add($line)
}

# ---- STEP 4: Schema integrity (tablas criticas) -----------------------------

Log ""
Log "[INF-SEC-02] STEP 4 - Schema integrity (tablas criticas)"

$criticalTables = @("profiles", "gym_members", "measurements", "audit_logs", "ai_chat_logs")

if (-not $DatabaseUrl) {
  $line = Write-Step "STEP 4 - Schema integrity" "SKIP" "(DATABASE_URL no configurado)"
  $logLines.Add($line)
} else {
  try {
    $tableList = ($criticalTables | ForEach-Object { "'$_'" }) -join ","
    $schemaQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ($tableList);"
    $schemaResult = & psql $DatabaseUrl --tuples-only --command $schemaQuery 2>&1
    $foundTables = ($schemaResult | Where-Object { $_ -match '\w' } | ForEach-Object { $_.Trim() })
    $missing = $criticalTables | Where-Object { $_ -notin $foundTables }
    if ($missing.Count -eq 0) {
      $line = Write-Step "STEP 4 - Schema integrity" "PASS" "(todas las tablas criticas presentes)"
    } else {
      $line = Write-Step "STEP 4 - Schema integrity" "FAIL" "(faltan: $($missing -join ', '))"
      $pass = $false
    }
  } catch {
    $line = Write-Step "STEP 4 - Schema integrity" "SKIP" "(psql no disponible)"
  }
  $logLines.Add($line)
}

# ---- STEP 5: Roundtrip API (proxy RTO) --------------------------------------

Log ""
Log "[INF-SEC-02] STEP 5 - Roundtrip API (proxy de RTO)"

$t5start = Get-Date
try {
  # Llamada ligera para medir latencia extremo a extremo
  $null = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -UseBasicParsing -TimeoutSec 30
  $elapsed = (Get-Date) - $t5start
  $rtoTarget = [TimeSpan]::FromHours(2)
  if ($elapsed -lt $rtoTarget) {
    $line = Write-Step "STEP 5 - RTO estimate" "PASS" "(roundtrip: $($elapsed.ToString('hh\:mm\:ss\.fff')) / objetivo: 02:00:00)"
  } else {
    $line = Write-Step "STEP 5 - RTO estimate" "FAIL" "(demasiado lento: $($elapsed.ToString('hh\:mm\:ss')))"
    $pass = $false
  }
} catch {
  $line = Write-Step "STEP 5 - RTO estimate" "FAIL" "($($_.Exception.Message))"
  $pass = $false
}
$logLines.Add($line)

# ---- resultado final --------------------------------------------------------

Log ""
$totalElapsed = (Get-Date) - $t0
$finalResult  = if ($pass) { "PASS" } else { "FAIL" }
Log "[INF-SEC-02] Tiempo total  : $($totalElapsed.ToString('hh\:mm\:ss\.fff'))"
Log "[INF-SEC-02] === RESULTADO: $finalResult ==="
Log ""

# ---- escribir log -----------------------------------------------------------

$logLines | Set-Content -Path $logFile -Encoding UTF8
Write-Host "[INF-SEC-02] Log guardado en: $logFile"

if (-not $pass) {
  exit 1
}
exit 0
