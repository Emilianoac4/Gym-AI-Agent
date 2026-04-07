$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000'
$loginEndpoint = "$baseUrl/auth/login"
$targetEndpoint = "$baseUrl/operations/admin-dashboard-summary"
$results = New-Object System.Collections.Generic.List[Object]

function Add-Result {
    param([string]$Test,[bool]$Pass,[string]$Observed,[string]$Details)
    $status = if ($Pass) { 'PASS' } else { 'FAIL' }
    Write-Host ("[{0}] {1} | {2} | {3}" -f $status, $Test, $Observed, $Details)
    $results.Add([pscustomobject]@{ Test=$Test; Status=$status; Observed=$Observed; Details=$Details }) | Out-Null
}

function Invoke-Api {
    param([string]$Method,[string]$Url,[object]$Body=$null,[hashtable]$Headers=$null)
    try {
        $invokeParams = @{ Method=$Method; Uri=$Url; TimeoutSec=15; ErrorAction='Stop' }
        if ($null -ne $Body) {
            $invokeParams.Body = ($Body | ConvertTo-Json -Depth 10)
            $invokeParams.ContentType = 'application/json'
        }
        if ($null -ne $Headers) { $invokeParams.Headers = $Headers }
        $resp = Invoke-WebRequest @invokeParams
        $parsed = $null
        if ($resp.Content) { try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content } }
        return [pscustomobject]@{ StatusCode=[int]$resp.StatusCode; Body=$parsed; Raw=$resp.Content; Error=$null }
    } catch {
        $statusCode = -1; $bodyText = ''; $parsedBody = $null
        if ($_.Exception.Response) {
            $response = $_.Exception.Response
            $statusCode = [int]$response.StatusCode
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $bodyText = $reader.ReadToEnd()
            $reader.Close()
            if ($bodyText) { try { $parsedBody = $bodyText | ConvertFrom-Json } catch { $parsedBody = $bodyText } }
        }
        return [pscustomobject]@{ StatusCode=$statusCode; Body=$parsedBody; Raw=$bodyText; Error=$_.Exception.Message }
    }
}

$adminCreds = @{ identifier='emilianoac4@gmail.com'; password='holamundo'; requiresGymSelection=$false }
$trainerCreds = @{ identifier='jairo1'; password='holamundo'; requiresGymSelection=$false }

$health = Invoke-Api -Method 'GET' -Url "$baseUrl/"
if ($health.StatusCode -eq -1) {
    Add-Result -Test 'Precheck server reachable' -Pass $false -Observed 'unreachable' -Details $health.Error
    Write-Host ''
    $results | Format-Table -AutoSize
    $passCount = ($results | Where-Object { $_.Status -eq 'PASS' } | Measure-Object).Count
    $failCount = ($results | Where-Object { $_.Status -eq 'FAIL' } | Measure-Object).Count
    Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)
    exit 1
}

$adminLogin = Invoke-Api -Method 'POST' -Url $loginEndpoint -Body $adminCreds
$adminToken = $adminLogin.Body.token
$adminRole = $adminLogin.Body.user.role
Add-Result -Test '1) Admin login' -Pass ($adminLogin.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($adminToken)) -Observed ("HTTP {0}" -f $adminLogin.StatusCode) -Details ("role={0}" -f $adminRole)

$trainerLogin = Invoke-Api -Method 'POST' -Url $loginEndpoint -Body $trainerCreds
$trainerToken = $trainerLogin.Body.token
$trainerRole = $trainerLogin.Body.user.role
Add-Result -Test '2) Trainer login' -Pass ($trainerLogin.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($trainerToken)) -Observed ("HTTP {0}" -f $trainerLogin.StatusCode) -Details ("role={0}" -f $trainerRole)

$adminCall = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$adminSummary = $adminCall.Body.summary
Add-Result -Test '3) Admin access' -Pass ($adminCall.StatusCode -eq 200 -and $null -ne $adminSummary) -Observed ("HTTP {0}" -f $adminCall.StatusCode) -Details ("hasSummary={0}" -f ($null -ne $adminSummary))

$noTokenCall = Invoke-Api -Method 'GET' -Url $targetEndpoint
$noTokenMsg = if ($noTokenCall.Body.message) { $noTokenCall.Body.message } else { $noTokenCall.Raw }
Add-Result -Test '4) No token' -Pass ($noTokenCall.StatusCode -eq 401) -Observed ("HTTP {0}" -f $noTokenCall.StatusCode) -Details ("message={0}" -f $noTokenMsg)

$invalidCall = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization='Bearer invalid.token.value' }
$invalidMsg = if ($invalidCall.Body.message) { $invalidCall.Body.message } else { $invalidCall.Raw }
Add-Result -Test '5) Invalid token' -Pass ($invalidCall.StatusCode -eq 401) -Observed ("HTTP {0}" -f $invalidCall.StatusCode) -Details ("message={0}" -f $invalidMsg)

$trainerCall = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization = "Bearer $trainerToken" }
$trainerMsg = if ($trainerCall.Body.message) { $trainerCall.Body.message } else { $trainerCall.Raw }
Add-Result -Test '6) Trainer forbidden' -Pass ($trainerCall.StatusCode -eq 403) -Observed ("HTTP {0}" -f $trainerCall.StatusCode) -Details ("message={0}" -f $trainerMsg)

$cacheCall1 = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
Start-Sleep -Seconds 1
$cacheCall2 = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$gen1 = $cacheCall1.Body.summary.generatedAt
$gen2 = $cacheCall2.Body.summary.generatedAt
$sameWithinWindow = ($cacheCall1.StatusCode -eq 200 -and $cacheCall2.StatusCode -eq 200 -and $gen1 -eq $gen2)
Start-Sleep -Seconds 31
$cacheCall3 = Invoke-Api -Method 'GET' -Url $targetEndpoint -Headers @{ Authorization = "Bearer $adminToken" }
$gen3 = $cacheCall3.Body.summary.generatedAt
$changedAfterWindow = ($cacheCall3.StatusCode -eq 200 -and $gen3 -ne $gen2)
Add-Result -Test '7) Cache behavior' -Pass ($sameWithinWindow -and $changedAfterWindow) -Observed ("HTTPs {0}/{1}/{2}" -f $cacheCall1.StatusCode,$cacheCall2.StatusCode,$cacheCall3.StatusCode) -Details ("generatedAt: first={0}; second={1}; third={2}" -f $gen1,$gen2,$gen3)

Write-Host ''
$results | Format-Table -AutoSize
$passCount = ($results | Where-Object { $_.Status -eq 'PASS' } | Measure-Object).Count
$failCount = ($results | Where-Object { $_.Status -eq 'FAIL' } | Measure-Object).Count
Write-Host ("Summary: PASS={0} FAIL={1}" -f $passCount, $failCount)
