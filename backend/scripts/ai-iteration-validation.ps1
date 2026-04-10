#!/usr/bin/env powershell
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Identifier = "",
  [string]$Password = "",
  [switch]$BootstrapRegister
)

$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "ASSERT FAILED: $Message"
  }
}

function Write-Step {
  param([string]$Message)
  Write-Host "`n[AI-VALIDATION] $Message" -ForegroundColor Yellow
}

function Login-User {
  param(
    [string]$BaseUrl,
    [string]$Identifier,
    [string]$Password
  )

  $loginBody = @{
    identifier = $Identifier
    password = $Password
  } | ConvertTo-Json

  $loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody

  if ($loginResp.requiresGymSelection -eq $true) {
    $firstGym = $loginResp.gyms | Select-Object -First 1
    Assert-Condition ($null -ne $firstGym) "requiresGymSelection returned but no gyms in response"

    $selectBody = @{
      selectorToken = $loginResp.selectorToken
      userId = $firstGym.userId
    } | ConvertTo-Json

    return Invoke-RestMethod -Uri "$BaseUrl/auth/select-gym" -Method Post -ContentType "application/json" -Body $selectBody
  }

  return $loginResp
}

Write-Host "=== Tuco AI Local Iteration Validation ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$rand = Get-Random

Write-Step "Checking /health"
$health = Invoke-RestMethod -Uri "$BaseUrl/health"
Assert-Condition ($null -ne $health) "Health response is null"
Write-Host "Health OK" -ForegroundColor Green

$effectiveIdentifier = if (-not [string]::IsNullOrWhiteSpace($Identifier)) { $Identifier } else { $env:AI_TEST_IDENTIFIER }
$effectivePassword = if (-not [string]::IsNullOrWhiteSpace($Password)) { $Password } else { $env:AI_TEST_PASSWORD }

if ([string]::IsNullOrWhiteSpace($effectiveIdentifier) -or [string]::IsNullOrWhiteSpace($effectivePassword)) {
  if (-not $BootstrapRegister) {
    throw "Provide -Identifier and -Password, or use -BootstrapRegister on a clean DB."
  }

  Write-Step "Registering bootstrap admin user"
  $effectiveIdentifier = "ai_iter_${rand}@tucofitness.com"
  $effectivePassword = "Test123456"
  $username = "iter${rand}"

  $registerBody = @{
    gym = @{
      name = "Tuco Test $timestamp"
      ownerName = "Owner Iteration"
      address = "Main street 123"
      phone = "+50688887777"
    }
    user = @{
      email = $effectiveIdentifier
      password = $effectivePassword
      fullName = "AI Iteration User"
      username = $username
      role = "admin"
    }
  } | ConvertTo-Json -Depth 5

  $registerResp = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
  Assert-Condition (-not [string]::IsNullOrWhiteSpace($registerResp.user.id)) "userId missing after register"
  Write-Host "Registered bootstrap user: $($registerResp.user.email)" -ForegroundColor Green
}

Write-Step "Logging in"
$sessionResp = Login-User -BaseUrl $BaseUrl -Identifier $effectiveIdentifier -Password $effectivePassword
$token = $sessionResp.token
$userId = $sessionResp.user.id

Assert-Condition (-not [string]::IsNullOrWhiteSpace($token)) "token missing after login"
Assert-Condition (-not [string]::IsNullOrWhiteSpace($userId)) "user id missing after login"

$authHeaders = @{ Authorization = "Bearer $token" }
Write-Host "Login OK for userId: $userId" -ForegroundColor Green

Write-Step "Updating user profile"
$profileBody = @{
  heightCm = 175
  goal = "Ganar masa muscular"
  medicalConds = "Ninguna"
  injuries = "Ninguna"
  experienceLvl = "Intermedio"
  availability = "4 dias por semana"
  dietPrefs = "Alto en proteina"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/users/$userId/profile" -Method Put -Headers $authHeaders -ContentType "application/json" -Body $profileBody | Out-Null
Write-Host "Profile updated" -ForegroundColor Green

Write-Step "Generating full routine"
$routineResp = Invoke-RestMethod -Uri "$BaseUrl/ai/$userId/routine" -Method Post -Headers $authHeaders -ContentType "application/json"
$routine = $routineResp.routine
Assert-Condition ($null -ne $routine) "routine payload missing"
Assert-Condition ($routine.sessions.Count -gt 0) "routine has no sessions"
foreach ($session in $routine.sessions) {
  Assert-Condition ($session.exercises.Count -gt 0) "session '$($session.day)' has no exercises"
}
$firstDay = $routine.sessions[0].day
Assert-Condition (-not [string]::IsNullOrWhiteSpace($firstDay)) "first session day is empty"
Write-Host "Routine OK: $($routine.sessions.Count) sessions" -ForegroundColor Green

Write-Step "Regenerating one routine day ($firstDay)"
$regenBody = @{ sessionDay = $firstDay } | ConvertTo-Json
$regenResp = Invoke-RestMethod -Uri "$BaseUrl/ai/$userId/routine/regenerate-day" -Method Post -Headers $authHeaders -ContentType "application/json" -Body $regenBody
$regenRoutine = $regenResp.routine
Assert-Condition ($null -ne $regenRoutine) "regenerate response missing routine"
$regenTarget = $regenRoutine.sessions | Where-Object { $_.day -eq $firstDay } | Select-Object -First 1
Assert-Condition ($null -ne $regenTarget) "regenerated day not found in routine"
Assert-Condition ($regenTarget.exercises.Count -gt 0) "regenerated day has no exercises"
Write-Host "Regenerate day OK: $firstDay with $($regenTarget.exercises.Count) exercises" -ForegroundColor Green

Write-Step "Sending chat message"
$chatBody = @{ message = "Hola, sabes quien soy?" } | ConvertTo-Json
$chatResp = Invoke-RestMethod -Uri "$BaseUrl/ai/$userId/chat" -Method Post -Headers $authHeaders -ContentType "application/json" -Body $chatBody
Assert-Condition (-not [string]::IsNullOrWhiteSpace($chatResp.response)) "chat response is empty"
Write-Host "Chat OK" -ForegroundColor Green

Write-Step "Fetching daily tip"
$tipResp = Invoke-RestMethod -Uri "$BaseUrl/ai/$userId/tip" -Method Get -Headers $authHeaders -ContentType "application/json"
Assert-Condition (-not [string]::IsNullOrWhiteSpace($tipResp.tip)) "tip response is empty"
Write-Host "Tip OK" -ForegroundColor Green

Write-Step "Checking AI history"
$historyResp = Invoke-RestMethod -Uri "$BaseUrl/ai/$userId/history?limit=20" -Method Get -Headers $authHeaders -ContentType "application/json"
Assert-Condition ($historyResp.count -ge 3) "history count is too low ($($historyResp.count))"
Write-Host "History OK: $($historyResp.count) entries" -ForegroundColor Green

Write-Host "`n=== AI ITERATION VALIDATION PASSED ===" -ForegroundColor Green
Write-Host "Identifier: $effectiveIdentifier" -ForegroundColor White
Write-Host "UserId: $userId" -ForegroundColor White
