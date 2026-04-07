$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000'

function Invoke-Api {
    param([string]$Method,[string]$Path,[object]$Body=$null,[hashtable]$Headers=$null)
    $params = @{ Method=$Method; Uri="$baseUrl$Path"; TimeoutSec=20; ErrorAction='Stop' }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10); $params.ContentType='application/json' }
    if ($null -ne $Headers) { $params.Headers = $Headers }
    $resp = Invoke-WebRequest @params
    $parsed = $null
    if ($resp.Content) { try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content } }
    [pscustomobject]@{ StatusCode=[int]$resp.StatusCode; Body=$parsed; Raw=$resp.Content }
}

$loginBody = @{ identifier='emilianoac4@gmail.com'; password='holamundo'; requiresGymSelection=$false }
$login = Invoke-Api -Method 'POST' -Path '/auth/login' -Body $loginBody
$token = $login.Body.token
if ($login.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($token)) { throw "Login failed HTTP $($login.StatusCode)" }
$headers = @{ Authorization = "Bearer $token" }

Write-Host "Login OK: HTTP $($login.StatusCode) role=$($login.Body.user.role)"

$summaryResp = Invoke-Api -Method 'GET' -Path '/operations/admin-dashboard-summary' -Headers $headers
$cards = $summaryResp.Body.summary.cards
$summaryExtract = [pscustomobject]@{
  subscriptionsActive = $cards.subscriptionsActive
  incomesToday = $cards.incomesToday
  churnRisk = $cards.churnRisk
}
Write-Host "admin-dashboard-summary extract:"
$summaryExtract | ConvertTo-Json -Depth 10 -Compress | Write-Host

$kpiResp = Invoke-Api -Method 'GET' -Path '/operations/kpi' -Headers $headers
Write-Host "kpi full response:"
$kpiResp.Body | ConvertTo-Json -Depth 20 -Compress | Write-Host

$churnResp = Invoke-Api -Method 'GET' -Path '/operations/churn-risk' -Headers $headers
$churnBody = $churnResp.Body
$list = $null
if ($churnBody -is [System.Array]) { $list = @($churnBody) }
elseif ($churnBody.usersAtRisk) { $list = @($churnBody.usersAtRisk) }
elseif ($churnBody.churnRisk) { $list = @($churnBody.churnRisk) }
elseif ($churnBody.data) { $list = @($churnBody.data) }
elseif ($churnBody.items) { $list = @($churnBody.items) }
else { $list = @() }

Write-Host "churn-risk length: $($list.Count)"
Write-Host "churn-risk first 3 entries:"
($list | Select-Object -First 3) | ConvertTo-Json -Depth 20 -Compress | Write-Host
