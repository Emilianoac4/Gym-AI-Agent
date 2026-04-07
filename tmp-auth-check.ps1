Set-Location "C:\Users\emili\OneDrive\Desktop\Agente_Gym\Agente_Gym"
$ErrorActionPreference='Stop'
function Invoke-Api {
    param([string]$Method,[string]$Url,[object]$Body=$null,[hashtable]$Headers=$null)
    try {
        $p=@{ Method=$Method; Uri=$Url; TimeoutSec=20; ErrorAction='Stop' }
        if($null -ne $Body){ $p.Body=($Body|ConvertTo-Json -Depth 10); $p.ContentType='application/json' }
        if($Headers){ $p.Headers=$Headers }
        $r=Invoke-WebRequest @p
        $parsed=$null
        if($r.Content){ try{ $parsed=$r.Content|ConvertFrom-Json } catch { $parsed=$r.Content } }
        [pscustomobject]@{ Status=[int]$r.StatusCode; Body=$parsed; Raw=$r.Content }
    } catch {
        $status=-1; $raw=''; $parsed=$null
        if($_.Exception.Response){
            $resp=$_.Exception.Response
            $status=[int]$resp.StatusCode
            $sr=New-Object System.IO.StreamReader($resp.GetResponseStream())
            $raw=$sr.ReadToEnd(); $sr.Close()
            if($raw){ try{ $parsed=$raw|ConvertFrom-Json } catch { $parsed=$raw } }
        }
        [pscustomobject]@{ Status=$status; Body=$parsed; Raw=$raw }
    }
}
$base='http://localhost:3000'
$login=Invoke-Api -Method 'POST' -Url "$base/auth/login" -Body @{ identifier='admin1'; password='holamundo' }
if($login.Status -ne 200 -or -not $login.Body.token){
    $msg=if($login.Body.message){$login.Body.message}else{$login.Raw}
    Write-Host ("DIAG login=FAIL status={0} message={1}" -f $login.Status,$msg)
    exit 0
}
Write-Host ("DIAG login=OK status={0} role={1} gymId={2}" -f $login.Status,$login.Body.user.role,$login.Body.user.gymId)
$h=@{ Authorization = "Bearer $($login.Body.token)" }
$ads=Invoke-Api -Method 'GET' -Url "$base/operations/admin-dashboard-summary" -Headers $h
$adsMsg=if($ads.Body.message){$ads.Body.message}else{''}
$hasSummary=($null -ne $ads.Body.summary)
Write-Host ("DIAG admin-dashboard-summary status={0} message={1} hasSummary={2}" -f $ads.Status,$adsMsg,$hasSummary)
$kpi=Invoke-Api -Method 'GET' -Url "$base/operations/kpi" -Headers $h
Write-Host ("DIAG kpi status={0}" -f $kpi.Status)
