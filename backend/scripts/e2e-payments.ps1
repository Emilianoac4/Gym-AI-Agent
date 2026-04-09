$ErrorActionPreference = "Stop"

function Read-ErrorBody($err) {
  $msg = $err.Exception.Message
  if ($err.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
      $msg = $reader.ReadToEnd()
      $reader.Close()
    } catch {}
  }
  return $msg
}

$base = "http://localhost:3000"

# 1) Health
try {
  $health = Invoke-RestMethod -Uri "$base/health" -Method Get -TimeoutSec 10
  Write-Output "[1_health] PASS=True STATUS=200 DETAIL=ok=$($health.ok)"
} catch {
  Write-Output "[1_health] PASS=False STATUS=0 DETAIL=$(Read-ErrorBody $_)"
  exit 1
}

# Get active admin + member context from DB
$probeRaw = node ./scripts/probe-admin.js
$ctx = $probeRaw | ConvertFrom-Json

if (-not $ctx.ok) {
  Write-Output "[2_context] PASS=False STATUS=0 DETAIL=$($ctx.error)"
  exit 1
}

$token = $ctx.token
$headers = @{ Authorization = "Bearer $token" }

$memberId = $null
if ($ctx.member -and $ctx.member.id) {
  $memberId = [string]$ctx.member.id
  Write-Output "[2_context] PASS=True STATUS=200 DETAIL=existingMember=$memberId"
} else {
  $rand = Get-Random -Minimum 1000 -Maximum 9999
  $createBody = @{
    email = "e2e_member_$rand@tuco.test"
    password = "Test123456"
    fullName = "E2E Member"
    username = "e2emember$rand"
    role = "member"
    membershipMonths = 1
    paymentMethod = "sinpe"
    paymentAmount = 15000
    profile = @{
      gender = "male"
      goal = "Aumento de masa muscular"
      availabilityDays = 4
      level = 3
    }
  } | ConvertTo-Json -Depth 10

  try {
    $createResp = Invoke-RestMethod -Uri "$base/users" -Method Post -Headers $headers -ContentType "application/json" -Body $createBody
    $memberId = [string]$createResp.user.id
    Write-Output "[2_context] PASS=True STATUS=201 DETAIL=createdMember=$memberId"
  } catch {
    Write-Output "[2_context] PASS=False STATUS=0 DETAIL=$(Read-ErrorBody $_)"
    exit 1
  }
}

# 3) Record payment
$payBody = @{
  userId = $memberId
  membershipMonths = 1
  paymentMethod = "sinpe"
  amount = 15000
  currency = "CRC"
  reference = "E2E-$(Get-Date -Format 'yyyyMMddHHmmss')"
  notes = "E2E payment flow"
} | ConvertTo-Json -Depth 8

try {
  $payResp = Invoke-RestMethod -Uri "$base/payments" -Method Post -Headers $headers -ContentType "application/json" -Body $payBody
  Write-Output "[3_record_payment] PASS=True STATUS=201 DETAIL=txId=$($payResp.transaction.id) method=$($payResp.transaction.paymentMethod) amount=$($payResp.transaction.amount) membershipStatus=$($payResp.membershipStatus)"
} catch {
  Write-Output "[3_record_payment] PASS=False STATUS=0 DETAIL=$(Read-ErrorBody $_)"
}

# 4) Membership status
try {
  $statusResp = Invoke-RestMethod -Uri "$base/payments/$memberId/status" -Method Get -Headers $headers
  Write-Output "[4_membership_status] PASS=True STATUS=200 DETAIL=status=$($statusResp.status) endAt=$($statusResp.membershipEndAt)"
} catch {
  Write-Output "[4_membership_status] PASS=False STATUS=0 DETAIL=$(Read-ErrorBody $_)"
}

# 5) Payment summary
try {
  $sumResp = Invoke-RestMethod -Uri "$base/payments/gym/summary" -Method Get -Headers $headers
  Write-Output "[5_payment_summary] PASS=True STATUS=200 DETAIL=totalTransactions=$($sumResp.totalTransactions) totalRevenue=$($sumResp.totalRevenue)"
} catch {
  Write-Output "[5_payment_summary] PASS=False STATUS=0 DETAIL=$(Read-ErrorBody $_)"
}
