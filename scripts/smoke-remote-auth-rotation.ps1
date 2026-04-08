param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$Identifier,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$EnvName = "staging",

  [switch]$RequiresGymSelection,

  [switch]$SkipHeaderCheck
)

$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [hashtable]$Headers = $null
  )

  try {
    $params = @{
      Method = $Method
      Uri = $Url
      TimeoutSec = 30
      UseBasicParsing = $true
      ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 10)
      $params.ContentType = "application/json"
    }

    if ($null -ne $Headers) {
      $params.Headers = $Headers
    }

    $resp = Invoke-WebRequest @params
    $parsed = $null
    if ($resp.Content) {
      try {
        $parsed = $resp.Content | ConvertFrom-Json
      } catch {
        $parsed = $resp.Content
      }
    }

    return [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      Body = $parsed
      Raw = $resp.Content
      Error = $null
    }
  } catch {
    $statusCode = -1
    $rawBody = ""
    $parsedBody = $null

    if ($_.Exception.Response) {
      $response = $_.Exception.Response
      $statusCode = [int]$response.StatusCode
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $rawBody = $reader.ReadToEnd()
      $reader.Close()

      if ($rawBody) {
        try {
          $parsedBody = $rawBody | ConvertFrom-Json
        } catch {
          $parsedBody = $rawBody
        }
      }
    }

    return [pscustomobject]@{
      StatusCode = $statusCode
      Body = $parsedBody
      Raw = $rawBody
      Error = $_.Exception.Message
    }
  }
}

function Add-Check {
  param(
    [string]$Name,
    [bool]$Pass,
    [string]$Observed,
    [string]$Details
  )

  $status = if ($Pass) { "PASS" } else { "FAIL" }
  Write-Host ("[{0}] {1} | {2} | {3}" -f $status, $Name, $Observed, $Details)

  return [pscustomobject]@{
    Name = $Name
    Status = $status
    Observed = $Observed
    Details = $Details
  }
}

$normalizedBase = $BaseUrl.TrimEnd("/")
$results = New-Object System.Collections.Generic.List[Object]

Write-Host "== Smoke remoto auth/rotacion =="
Write-Host ("Entorno: {0}" -f $EnvName)
Write-Host ("Base URL: {0}" -f $normalizedBase)

if (-not $SkipHeaderCheck) {
  try {
    $healthResp = Invoke-WebRequest -Uri "$normalizedBase/health" -Method Get -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
    $results.Add((Add-Check -Name "Precheck backend reachable" -Pass ($healthResp.StatusCode -eq 200) -Observed "GET /health" -Details ("HTTP {0}" -f [int]$healthResp.StatusCode))) | Out-Null
  } catch {
    $results.Add((Add-Check -Name "Precheck backend reachable" -Pass $false -Observed "GET /health" -Details $_.Exception.Message)) | Out-Null
  }
}

$refreshProbe = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/refresh" -Body @{ refreshToken = "invalid-probe-token" }
$refreshRouteAvailable = ($refreshProbe.StatusCode -ne 404)
$results.Add((Add-Check -Name "Route check /auth/refresh" -Pass $refreshRouteAvailable -Observed ("HTTP {0}" -f $refreshProbe.StatusCode) -Details "expected route available")) | Out-Null

$logoutProbe = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/logout" -Body @{ refreshToken = "invalid-probe-token" }
$logoutRouteAvailable = ($logoutProbe.StatusCode -ne 404)
$results.Add((Add-Check -Name "Route check /auth/logout" -Pass $logoutRouteAvailable -Observed ("HTTP {0}" -f $logoutProbe.StatusCode) -Details "expected route available")) | Out-Null

if (-not $refreshRouteAvailable -or -not $logoutRouteAvailable) {
  Write-Host ""
  Write-Host "El entorno remoto no tiene BE-SEC-01 desplegado (refresh/logout)."
  Write-Host "Accion requerida: desplegar backend con rutas /auth/refresh y /auth/logout antes de este smoke."
  $passCount = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
  $failCount = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
  Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)
  exit 1
}

$loginBody = @{
  identifier = $Identifier
  password = $Password
  requiresGymSelection = [bool]$RequiresGymSelection
}

$login = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/login" -Body $loginBody
$loginToken = $null
$loginRefresh = $null
if ($login.Body) {
  $loginToken = $login.Body.token
  $loginRefresh = $login.Body.refreshToken
}

$results.Add((Add-Check -Name "Login" -Pass ($login.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($loginToken) -and -not [string]::IsNullOrWhiteSpace($loginRefresh)) -Observed ("HTTP {0}" -f $login.StatusCode) -Details "access+refresh expected")) | Out-Null

if ($login.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($loginRefresh)) {
  Write-Host ""
  Write-Host "No se puede continuar sin refresh token valido."
  $passCount = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
  $failCount = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
  Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)
  exit 1
}

$refresh = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/refresh" -Body @{ refreshToken = $loginRefresh }
$newAccess = $null
$newRefresh = $null
if ($refresh.Body) {
  $newAccess = $refresh.Body.token
  $newRefresh = $refresh.Body.refreshToken
}

$results.Add((Add-Check -Name "Refresh" -Pass ($refresh.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($newAccess) -and -not [string]::IsNullOrWhiteSpace($newRefresh)) -Observed ("HTTP {0}" -f $refresh.StatusCode) -Details "rotation expected")) | Out-Null

$logoutToken = if (-not [string]::IsNullOrWhiteSpace($newRefresh)) { $newRefresh } else { $loginRefresh }
$bearer = if (-not [string]::IsNullOrWhiteSpace($newAccess)) { $newAccess } else { $loginToken }

$logout = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/logout" -Body @{ refreshToken = $logoutToken } -Headers @{ Authorization = "Bearer $bearer" }
$results.Add((Add-Check -Name "Logout" -Pass ($logout.StatusCode -eq 200) -Observed ("HTTP {0}" -f $logout.StatusCode) -Details "refresh should be revoked")) | Out-Null

$replay = Invoke-Api -Method "POST" -Url "$normalizedBase/auth/refresh" -Body @{ refreshToken = $logoutToken }
$results.Add((Add-Check -Name "Refresh replay blocked" -Pass ($replay.StatusCode -eq 401) -Observed ("HTTP {0}" -f $replay.StatusCode) -Details "revoked refresh must fail")) | Out-Null

Write-Host ""
$results | Format-Table -AutoSize

$passCount = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)

if ($failCount -gt 0) {
  exit 1
}

exit 0
