$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000'

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = $null
    )
    $uri = "$baseUrl$Path"
    try {
        $params = @{ Method = $Method; Uri = $uri; TimeoutSec = 20; ErrorAction = 'Stop' }
        if ($null -ne $Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
            $params.ContentType = 'application/json'
        }
        if ($null -ne $Headers) { $params.Headers = $Headers }
        $resp = Invoke-WebRequest @params
        $parsed = $null
        if ($resp.Content) { try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content } }
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $parsed; Raw = $resp.Content; Path=$Path }
    } catch {
        $status = -1; $raw = ''; $parsed = $null
        if ($_.Exception.Response) {
            $r = $_.Exception.Response
            $status = [int]$r.StatusCode
            $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
            $raw = $sr.ReadToEnd()
            $sr.Close()
            if ($raw) { try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $raw } }
        }
        return [pscustomobject]@{ Status = $status; Body = $parsed; Raw = $raw; Path=$Path }
    }
}

$loginBody = @{ identifier='emilianoac4@gmail.com'; password='holamundo'; requiresGymSelection=$false }
$login = Invoke-Api -Method 'POST' -Path '/auth/login' -Body $loginBody
if ($login.Status -ne 200 -or [string]::IsNullOrWhiteSpace($login.Body.token)) {
    Write-Host "Login failed: HTTP $($login.Status)"
    if ($login.Raw) { Write-Host $login.Raw }
    exit 1
}
$token = $login.Body.token
$headers = @{ Authorization = "Bearer $token" }

$summary = Invoke-Api -Method 'GET' -Path '/operations/admin-dashboard-summary' -Headers $headers
$kpi = Invoke-Api -Method 'GET' -Path '/operations/kpi' -Headers $headers
$churn = Invoke-Api -Method 'GET' -Path '/operations/churn-risk' -Headers $headers
$activeTrainers = Invoke-Api -Method 'GET' -Path '/operations/active-trainers' -Headers $headers

$threadCandidates = @('/messages/my-threads','/messages/threads-unread','/messages/threads','/messages/unread-threads')
$threads = $null
$threadsPathUsed = $null
foreach ($p in $threadCandidates) {
    $tryResp = Invoke-Api -Method 'GET' -Path $p -Headers $headers
    if ($tryResp.Status -ne 404 -and $tryResp.Status -ne -1) { $threads = $tryResp; $threadsPathUsed = $p; break }
}
if ($null -eq $threads) {
    $threads = [pscustomobject]@{ Status = 404; Body = $null; Raw = 'Threads endpoint not found'; Path = 'N/A' }
}

$summaryBody = $summary.Body.summary
$trainersSummary = $summaryBody.cards.trainersActiveNow.value
$churnSummary = $summaryBody.cards.churnRisk.value
$subsSummary = $summaryBody.cards.subscriptionsActive.value
$incomeSummary = $summaryBody.cards.incomesToday.value

$activeTrainerCount = $null
if ($activeTrainers.Body) {
    if ($activeTrainers.Body.activeTrainers) { $activeTrainerCount = @($activeTrainers.Body.activeTrainers).Count }
    elseif ($activeTrainers.Body.trainers) { $activeTrainerCount = @($activeTrainers.Body.trainers).Count }
    elseif ($activeTrainers.Body.data) { $activeTrainerCount = @($activeTrainers.Body.data).Count }
    elseif ($activeTrainers.Body.count -ne $null) { $activeTrainerCount = [int]$activeTrainers.Body.count }
}

$churnListCount = $null
if ($churn.Body) {
    if ($churn.Body.usersAtRisk) { $churnListCount = @($churn.Body.usersAtRisk).Count }
    elseif ($churn.Body.churnRisk) { $churnListCount = @($churn.Body.churnRisk).Count }
    elseif ($churn.Body.data) { $churnListCount = @($churn.Body.data).Count }
    elseif ($churn.Body -is [System.Array]) { $churnListCount = @($churn.Body).Count }
}

$kpiMembersActive = $kpi.Body.membersWithActiveMembership
$kpiRevenueToday = $kpi.Body.today.revenue

function Compare-Values {
    param([string]$Metric,[object]$SummaryValue,[object]$LegacyValue,[string]$LegacySource)
    $pass = ($null -ne $SummaryValue -and $null -ne $LegacyValue -and [string]$SummaryValue -eq [string]$LegacyValue)
    $status = if ($pass) { 'PASS' } else { 'WARN' }
    $explain = if ($pass) { 'Values match.' } else { 'Mismatch or missing legacy/summary value.' }
    [pscustomobject]@{
        Metric = $Metric
        SummaryValue = $SummaryValue
        LegacyValue = $LegacyValue
        LegacySource = $LegacySource
        Status = $status
        Note = $explain
    }
}

$report = @(
    Compare-Values -Metric 'trainersActiveNow vs active-trainers count' -SummaryValue $trainersSummary -LegacyValue $activeTrainerCount -LegacySource '/operations/active-trainers'
    Compare-Values -Metric 'churnRisk count vs churn-risk list length' -SummaryValue $churnSummary -LegacyValue $churnListCount -LegacySource '/operations/churn-risk'
    Compare-Values -Metric 'subscriptionsActive vs kpi.membersWithActiveMembership' -SummaryValue $subsSummary -LegacyValue $kpiMembersActive -LegacySource '/operations/kpi'
    Compare-Values -Metric 'incomesToday.value vs kpi.today.revenue' -SummaryValue $incomeSummary -LegacyValue $kpiRevenueToday -LegacySource '/operations/kpi'
)

$threadsLabel = if ($threadsPathUsed) { $threadsPathUsed } else { 'not found' }
Write-Host "Login: HTTP $($login.Status) role=$($login.Body.user.role)"
Write-Host "Endpoint status: summary=$($summary.Status), kpi=$($kpi.Status), churn-risk=$($churn.Status), active-trainers=$($activeTrainers.Status), threads=$($threads.Status) ($threadsLabel)"
if ($threads.Status -eq 404) { Write-Host "Threads endpoint note: /messages/my-threads or equivalent not found." }

$report | Format-Table -AutoSize

$warnCount = ($report | Where-Object { $_.Status -eq 'WARN' } | Measure-Object).Count
$passCount = ($report | Where-Object { $_.Status -eq 'PASS' } | Measure-Object).Count
Write-Host "Summary: PASS=$passCount WARN=$warnCount"
