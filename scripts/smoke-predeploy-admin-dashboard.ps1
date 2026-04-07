param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminIdentifier,
  [string]$AdminPassword,
  [string]$TrainerIdentifier,
  [string]$TrainerPassword,
  [string]$AdminGymName,
  [string]$TrainerGymName,
  [int]$CacheTtlSeconds = 30
)

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues["Invoke-WebRequest:UseBasicParsing"] = $true

$AdminIdentifier = if ($AdminIdentifier) { $AdminIdentifier } else { $env:SMOKE_ADMIN_IDENTIFIER }
$AdminPassword = if ($AdminPassword) { $AdminPassword } else { $env:SMOKE_ADMIN_PASSWORD }
$TrainerIdentifier = if ($TrainerIdentifier) { $TrainerIdentifier } else { $env:SMOKE_TRAINER_IDENTIFIER }
$TrainerPassword = if ($TrainerPassword) { $TrainerPassword } else { $env:SMOKE_TRAINER_PASSWORD }

if ([string]::IsNullOrWhiteSpace($AdminIdentifier) -or
    [string]::IsNullOrWhiteSpace($AdminPassword) -or
    [string]::IsNullOrWhiteSpace($TrainerIdentifier) -or
    [string]::IsNullOrWhiteSpace($TrainerPassword)) {
  Write-Host "Missing credentials. Provide params or env vars:"
  Write-Host "SMOKE_ADMIN_IDENTIFIER, SMOKE_ADMIN_PASSWORD, SMOKE_TRAINER_IDENTIFIER, SMOKE_TRAINER_PASSWORD"
  exit 2
}

$loginEndpoint = "$BaseUrl/auth/login"
$selectGymEndpoint = "$BaseUrl/auth/select-gym"
$targetEndpoint = "$BaseUrl/operations/admin-dashboard-summary"
$kpiEndpoint = "$BaseUrl/operations/kpi"
$churnRiskEndpoint = "$BaseUrl/operations/churn-risk"
$activeTrainersEndpoint = "$BaseUrl/operations/active-trainers"
$results = New-Object System.Collections.Generic.List[Object]
$effectiveCacheWaitSeconds = [Math]::Max($CacheTtlSeconds + 1, 31)

function Add-Result {
  param([string]$Test,[bool]$Pass,[string]$Observed,[string]$Details)
  $status = if ($Pass) { "PASS" } else { "FAIL" }
  Write-Host ("[{0}] {1} | {2} | {3}" -f $status, $Test, $Observed, $Details)
  $results.Add([pscustomobject]@{
    Test = $Test
    Status = $status
    Observed = $Observed
    Details = $Details
  }) | Out-Null
}

function Get-ErrorBody {
  param([object]$Exception)

  if (-not $Exception) { return $null }

  if ($Exception.PSObject.Properties["Response"] -and $Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($Exception.Response.GetResponseStream())
      $bodyText = $reader.ReadToEnd()
      $reader.Close()
      return $bodyText
    } catch {
      return $null
    }
  }

  return $null
}

function Invoke-Api {
  param([string]$Method,[string]$Url,[object]$Body=$null,[hashtable]$Headers=$null)

  try {
    $invokeParams = @{ Method=$Method; Uri=$Url; TimeoutSec=20; ErrorAction="Stop" }
    if ($null -ne $Body) {
      $invokeParams.Body = ($Body | ConvertTo-Json -Depth 20)
      $invokeParams.ContentType = "application/json"
    }
    if ($null -ne $Headers) {
      $invokeParams.Headers = $Headers
    }

    $resp = Invoke-WebRequest @invokeParams
    $parsed = $null
    if ($resp.Content) {
      try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content }
    }

    return [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      Body = $parsed
      Raw = $resp.Content
      Error = $null
    }
  } catch {
    $statusCode = -1
    $rawBody = Get-ErrorBody -Exception $_.Exception
    $parsedBody = $null

    if ($rawBody) {
      try { $parsedBody = $rawBody | ConvertFrom-Json } catch { $parsedBody = $rawBody }
    }

    if ($_.Exception.PSObject.Properties["Response"] -and $_.Exception.Response) {
      try {
        $statusCode = [int]$_.Exception.Response.StatusCode
      } catch {
        $statusCode = -1
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

function Resolve-LoginToken {
  param(
    [string]$Identifier,
    [string]$Password,
    [string]$ExpectedRole,
    [string]$GymName
  )

  $login = Invoke-Api -Method "POST" -Url $loginEndpoint -Body @{ identifier = $Identifier; password = $Password }

  if ($login.StatusCode -ne 200) {
    return [pscustomobject]@{
      StatusCode = $login.StatusCode
      Token = $null
      Role = $null
      Details = "Login failed"
      RawResponse = $login
    }
  }

  if ($login.Body.token) {
    return [pscustomobject]@{
      StatusCode = 200
      Token = [string]$login.Body.token
      Role = [string]$login.Body.user.role
      Details = "Direct token"
      RawResponse = $login
    }
  }

  if ($login.Body.requiresGymSelection -ne $true) {
    return [pscustomobject]@{
      StatusCode = 500
      Token = $null
      Role = $null
      Details = "Login response missing token and requiresGymSelection"
      RawResponse = $login
    }
  }

  $gyms = @($login.Body.gyms)
  if ($gyms.Count -eq 0) {
    return [pscustomobject]@{
      StatusCode = 500
      Token = $null
      Role = $null
      Details = "No gyms available for selection"
      RawResponse = $login
    }
  }

  $candidate = $null
  if ($GymName) {
    $candidate = $gyms | Where-Object { $_.gymName -eq $GymName -and $_.role -eq $ExpectedRole } | Select-Object -First 1
  }
  if (-not $candidate) {
    $candidate = $gyms | Where-Object { $_.role -eq $ExpectedRole } | Select-Object -First 1
  }
  if (-not $candidate) {
    $candidate = $gyms | Select-Object -First 1
  }

  $select = Invoke-Api -Method "POST" -Url $selectGymEndpoint -Body @{
    selectorToken = $login.Body.selectorToken
    userId = $candidate.userId
  }

  if ($select.StatusCode -ne 200 -or -not $select.Body.token) {
    return [pscustomobject]@{
      StatusCode = $select.StatusCode
      Token = $null
      Role = $null
      Details = "Gym selection failed"
      RawResponse = $select
    }
  }

  return [pscustomobject]@{
    StatusCode = 200
    Token = [string]$select.Body.token
    Role = [string]$select.Body.user.role
    Details = "Token from gym selector"
    RawResponse = $select
  }
}

$health = Invoke-Api -Method "GET" -Url "$BaseUrl/health"
if ($health.StatusCode -eq -1) {
  $health = Invoke-Api -Method "GET" -Url "$BaseUrl/"
}

if ($health.StatusCode -eq -1) {
  Add-Result -Test "0) Precheck server reachable" -Pass $false -Observed "unreachable" -Details $health.Error
  Write-Host ""
  $results | Format-Table -AutoSize
  $passCount = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
  $failCount = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
  Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)
  exit 1
}

$adminAuth = Resolve-LoginToken -Identifier $AdminIdentifier -Password $AdminPassword -ExpectedRole "admin" -GymName $AdminGymName
$adminToken = $adminAuth.Token
Add-Result -Test "1) Admin login" `
  -Pass ($adminAuth.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($adminToken) -and $adminAuth.Role -eq "admin") `
  -Observed ("HTTP {0}" -f $adminAuth.StatusCode) `
  -Details ("role={0}; mode={1}" -f $adminAuth.Role, $adminAuth.Details)

$trainerAuth = Resolve-LoginToken -Identifier $TrainerIdentifier -Password $TrainerPassword -ExpectedRole "trainer" -GymName $TrainerGymName
$trainerToken = $trainerAuth.Token
Add-Result -Test "2) Trainer login" `
  -Pass ($trainerAuth.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($trainerToken) -and $trainerAuth.Role -eq "trainer") `
  -Observed ("HTTP {0}" -f $trainerAuth.StatusCode) `
  -Details ("role={0}; mode={1}" -f $trainerAuth.Role, $trainerAuth.Details)

$adminCall = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$hasSummary = ($null -ne $adminCall.Body -and $null -ne $adminCall.Body.summary)
Add-Result -Test "3) Admin access" `
  -Pass ($adminCall.StatusCode -eq 200 -and $hasSummary) `
  -Observed ("HTTP {0}" -f $adminCall.StatusCode) `
  -Details ("hasSummary={0}" -f $hasSummary)

$noTokenCall = Invoke-Api -Method "GET" -Url $targetEndpoint
$noTokenMsg = if ($noTokenCall.Body -and $noTokenCall.Body.message) { $noTokenCall.Body.message } else { $noTokenCall.Raw }
Add-Result -Test "4) No token" `
  -Pass ($noTokenCall.StatusCode -eq 401) `
  -Observed ("HTTP {0}" -f $noTokenCall.StatusCode) `
  -Details ("message={0}" -f $noTokenMsg)

$invalidCall = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer invalid.token.value" }
$invalidMsg = if ($invalidCall.Body -and $invalidCall.Body.message) { $invalidCall.Body.message } else { $invalidCall.Raw }
Add-Result -Test "5) Invalid token" `
  -Pass ($invalidCall.StatusCode -eq 401) `
  -Observed ("HTTP {0}" -f $invalidCall.StatusCode) `
  -Details ("message={0}" -f $invalidMsg)

$trainerCall = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer $trainerToken" }
$trainerMsg = if ($trainerCall.Body -and $trainerCall.Body.message) { $trainerCall.Body.message } else { $trainerCall.Raw }
Add-Result -Test "6) Trainer forbidden" `
  -Pass ($trainerCall.StatusCode -eq 403) `
  -Observed ("HTTP {0}" -f $trainerCall.StatusCode) `
  -Details ("message={0}" -f $trainerMsg)

$cacheCall1 = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
Start-Sleep -Seconds 1
$cacheCall2 = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$gen1 = $cacheCall1.Body.summary.generatedAt
$gen2 = $cacheCall2.Body.summary.generatedAt
$sameWithinWindow = ($cacheCall1.StatusCode -eq 200 -and $cacheCall2.StatusCode -eq 200 -and $gen1 -eq $gen2)
Start-Sleep -Seconds $effectiveCacheWaitSeconds
$cacheCall3 = Invoke-Api -Method "GET" -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$gen3 = $cacheCall3.Body.summary.generatedAt
$changedAfterWindow = ($cacheCall3.StatusCode -eq 200 -and $gen3 -ne $gen2)

Add-Result -Test "7) Cache behavior" `
  -Pass ($sameWithinWindow -and $changedAfterWindow) `
  -Observed ("HTTPs {0}/{1}/{2}" -f $cacheCall1.StatusCode, $cacheCall2.StatusCode, $cacheCall3.StatusCode) `
  -Details ("generatedAt: first={0}; second={1}; third={2}; waited={3}s" -f $gen1, $gen2, $gen3, $effectiveCacheWaitSeconds)

$contractOk = $false
if ($adminCall.StatusCode -eq 200 -and $adminCall.Body.summary) {
  $summary = $adminCall.Body.summary
  $requiredCardNames = @(
    "trainersActiveNow",
    "usersActiveToday",
    "subscriptionsActive",
    "subscriptionsExpired",
    "assistancePending",
    "unreadThreadsForAdmin",
    "renewalsToday",
    "incomesToday",
    "churnRisk"
  )

  $missing = @()
  foreach ($name in $requiredCardNames) {
    if (-not $summary.cards.PSObject.Properties.Name.Contains($name)) {
      $missing += $name
    }
  }

  $contractOk = ($summary.v -eq 1 -and $summary.generatedAt -and $summary.timezone -and $missing.Count -eq 0)
  $missingText = if ($missing.Count -eq 0) { "none" } else { ($missing -join ",") }
  Add-Result -Test "8) Summary contract" `
    -Pass $contractOk `
    -Observed "schema check" `
    -Details ("v={0}; timezone={1}; missingCards={2}" -f $summary.v, $summary.timezone, $missingText)
} else {
  Add-Result -Test "8) Summary contract" -Pass $false -Observed "schema check" -Details "Cannot validate without successful admin summary response"
}

$kpiCall = Invoke-Api -Method "GET" -Url $kpiEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$churnCall = Invoke-Api -Method "GET" -Url $churnRiskEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$activeTrainersCall = Invoke-Api -Method "GET" -Url $activeTrainersEndpoint -Headers @{ Authorization = "Bearer $adminToken" }

if ($adminCall.StatusCode -eq 200 -and $adminCall.Body.summary -and $activeTrainersCall.StatusCode -eq 200) {
  $summaryTrainers = [int]$adminCall.Body.summary.cards.trainersActiveNow.value
  $legacyTrainers = @($activeTrainersCall.Body.trainers).Count
  Add-Result -Test "9) Consistency trainers active" `
    -Pass ($summaryTrainers -eq $legacyTrainers) `
    -Observed "summary vs /active-trainers" `
    -Details ("summary={0}; legacy={1}" -f $summaryTrainers, $legacyTrainers)
} else {
  Add-Result -Test "9) Consistency trainers active" -Pass $false -Observed "summary vs /active-trainers" -Details "Missing successful responses"
}

if ($adminCall.StatusCode -eq 200 -and $adminCall.Body.summary -and $kpiCall.StatusCode -eq 200 -and $kpiCall.Body.kpi) {
  $summarySubs = [int]$adminCall.Body.summary.cards.subscriptionsActive.value
  $legacySubs = [int]$kpiCall.Body.kpi.membersWithActiveMembership
  Add-Result -Test "10) Consistency active subscriptions" `
    -Pass ($summarySubs -eq $legacySubs) `
    -Observed "summary vs /kpi" `
    -Details ("summary={0}; legacy={1}" -f $summarySubs, $legacySubs)

  $summaryRevenue = [double]$adminCall.Body.summary.cards.incomesToday.value
  $legacyRevenue = [double]$kpiCall.Body.kpi.today.revenue
  $sameRevenue = ([Math]::Abs($summaryRevenue - $legacyRevenue) -lt 0.0001)
  Add-Result -Test "11) Consistency today revenue" `
    -Pass $sameRevenue `
    -Observed "summary vs /kpi.today.revenue" `
    -Details ("summary={0}; legacy={1}" -f $summaryRevenue, $legacyRevenue)
} else {
  Add-Result -Test "10) Consistency active subscriptions" -Pass $false -Observed "summary vs /kpi" -Details "Missing successful responses"
  Add-Result -Test "11) Consistency today revenue" -Pass $false -Observed "summary vs /kpi.today.revenue" -Details "Missing successful responses"
}

if ($adminCall.StatusCode -eq 200 -and $adminCall.Body.summary -and $churnCall.StatusCode -eq 200) {
  $summaryChurn = [int]$adminCall.Body.summary.cards.churnRisk.count
  $legacyChurn = @($churnCall.Body.churnRisk).Count
  Add-Result -Test "12) Consistency churn risk" `
    -Pass ($summaryChurn -eq $legacyChurn) `
    -Observed "summary vs /churn-risk" `
    -Details ("summary={0}; legacy={1}" -f $summaryChurn, $legacyChurn)
} else {
  Add-Result -Test "12) Consistency churn risk" -Pass $false -Observed "summary vs /churn-risk" -Details "Missing successful responses"
}

Write-Host ""
$results | Format-Table -AutoSize
$passCount = ($results | Where-Object { $_.Status -eq "PASS" } | Measure-Object).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" } | Measure-Object).Count
Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)

if ($failCount -gt 0) {
  exit 1
}

exit 0
