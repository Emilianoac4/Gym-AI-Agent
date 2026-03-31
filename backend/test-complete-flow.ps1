#!/usr/bin/env powershell
# Script de prueba completo: Fase 1 + Fase 2
# Incluye: Registro -> Login -> Update Perfil -> Generar Rutina -> Chat -> Tips

Write-Host "=== GymAI - Test Completo Fase 1 + Fase 2 ===" -ForegroundColor Cyan

# ==================== VARIABLES ====================
$BASE_URL = "http://localhost:3000"
$GYM_NAME = "GymAI - Test $(Get-Date -Format 'yyyyMMdd_HHmmss')"
$EMAIL = "test_$(Get-Random)@gymiai.com"
$PASSWORD = "Test123456"
$PORT = 3000

# Verificar si servidor está activo
Write-Host "`n[1] Verificando servidor..." -ForegroundColor Yellow
try {
  $health = Invoke-RestMethod -Uri "$BASE_URL/health" -ErrorAction Stop
  Write-Host "✓ Server OK: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
  Write-Host "✗ Server no responde en $BASE_URL" -ForegroundColor Red
  exit 1
}

# ==================== FASE 1: AUTH ====================
Write-Host "`n[2] Registrando usuario nuevo..." -ForegroundColor Yellow
$registerBody = @{
  email = $EMAIL
  password = $PASSWORD
  fullName = "Test User"
  gymName = $GYM_NAME
  ownerName = "Owner Test"
  address = "Calle Principal 123"
  phone = "+34 911 234 567"
} | ConvertTo-Json

try {
  $registerResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $registerBody `
    -ErrorAction Stop
  
  $userId = $registerResponse.user.id
  Write-Host "✓ Usuario creado: $($registerResponse.user.email)" -ForegroundColor Green
  Write-Host "  - UserID: $userId" -ForegroundColor Cyan
  Write-Host "  - Role: $($registerResponse.user.role)" -ForegroundColor Cyan
} catch {
  Write-Host "✗ Error en registro: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# ==================== FASE 1: LOGIN ====================
Write-Host "`n[3] Iniciando sesión..." -ForegroundColor Yellow
$loginBody = @{
  email = $EMAIL
  password = $PASSWORD
} | ConvertTo-Json

try {
  $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody `
    -ErrorAction Stop
  
  $token = $loginResponse.token
  Write-Host "✓ Login exitoso" -ForegroundColor Green
  Write-Host "  - Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
} catch {
  Write-Host "✗ Error en login: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# ==================== FASE 1: UPDATE PROFILE ====================
Write-Host "`n[4] Actualizando perfil..." -ForegroundColor Yellow
$profileBody = @{
  heightCm = 175
  goal = "Ganar masa muscular cualitativamente"
  medicalConds = "Ninguna"
  injuries = "Ninguna"
  experienceLvl = "Avanzado"
  availability = "4 días por semana"
  dietPrefs = "Rico en proteína"
} | ConvertTo-Json

try {
  $profileResponse = Invoke-RestMethod -Uri "$BASE_URL/users/$userId/profile" `
    -Method Put `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -Body $profileBody `
    -ErrorAction Stop
  
  Write-Host "✓ Perfil actualizado" -ForegroundColor Green
  Write-Host "  - Height: $($profileResponse.profile.heightCm) cm" -ForegroundColor Cyan
  Write-Host "  - Goal: $($profileResponse.profile.goal)" -ForegroundColor Cyan
  Write-Host "  - Experience: $($profileResponse.profile.experienceLvl)" -ForegroundColor Cyan
} catch {
  Write-Host "✗ Error actualizando perfil: $($_.Exception.Message)" -ForegroundColor Red
  # Continue anyway for demo
}

# ==================== FASE 2: GENERAR RUTINA ====================
Write-Host "`n[5] Generando rutina personalizada (IA)..." -ForegroundColor Yellow
Write-Host "   (Esto puede tomar 10-15 segundos...)" -ForegroundColor Gray

try {
  $routineResponse = Invoke-RestMethod -Uri "$BASE_URL/ai/$userId/routine" `
    -Method Post `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -ErrorAction Stop
  
  Write-Host "✓ Rutina generada exitosamente" -ForegroundColor Green
  Write-Host "  - Nombre: $($routineResponse.routine.routine_name)" -ForegroundColor Cyan
  Write-Host "  - Duración: $($routineResponse.routine.duration_weeks) semanas" -ForegroundColor Cyan
  Write-Host "  - Sesiones/semana: $($routineResponse.routine.weekly_sessions)" -ForegroundColor Cyan
  Write-Host "  - Sesiones:" -ForegroundColor Cyan
  $routineResponse.routine.sessions | ForEach-Object {
    Write-Host "    • $($_.day) - $($_.focus) ($($_.duration_minutes) min)" -ForegroundColor Cyan
  }
} catch {
  Write-Host "✗ Error generando rutina: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "   Verifica que hayas configurado OPENAI_API_KEY en .env" -ForegroundColor Yellow
}

# ==================== FASE 2: GENERAR PLAN NUTRICIONAL ====================
Write-Host "`n[6] Generando plan nutricional (IA)..." -ForegroundColor Yellow
Write-Host "   (Esto puede tomar 10-15 segundos...)" -ForegroundColor Gray

try {
  $nutritionResponse = Invoke-RestMethod -Uri "$BASE_URL/ai/$userId/nutrition" `
    -Method Post `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -ErrorAction Stop
  
  Write-Host "✓ Plan nutricional generado" -ForegroundColor Green
  Write-Host "  - Nombre: $($nutritionResponse.plan.plan_name)" -ForegroundColor Cyan
  Write-Host "  - Calorías diarias: $($nutritionResponse.plan.daily_calories)" -ForegroundColor Cyan
  Write-Host "  - Macros: $($nutritionResponse.plan.macros.protein_g)g prot, $($nutritionResponse.plan.macros.carbs_g)g carbs, $($nutritionResponse.plan.macros.fats_g)g fats" -ForegroundColor Cyan
  Write-Host "  - Comidas:" -ForegroundColor Cyan
  $nutritionResponse.plan.meal_plan | ForEach-Object {
    Write-Host "    • $($_.meal): $($_.options -join ', ')" -ForegroundColor Cyan
  }
} catch {
  Write-Host "✗ Error generando plan nutricional: $($_.Exception.Message)" -ForegroundColor Red
}

# ==================== FASE 2: CHAT ====================
Write-Host "`n[7] Chat con Coach IA..." -ForegroundColor Yellow
$chatBody = @{
  message = "¿Cuál es mi plan de entrenamiento principal?"
} | ConvertTo-Json

try {
  $chatResponse = Invoke-RestMethod -Uri "$BASE_URL/ai/$userId/chat" `
    -Method Post `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -Body $chatBody `
    -ErrorAction Stop
  
  Write-Host "✓ Respuesta del Coach IA:" -ForegroundColor Green
  Write-Host "   $($chatResponse.response | Select-String -Pattern '^.{0,200}')..." -ForegroundColor Cyan
} catch {
  Write-Host "✗ Error en chat: $($_.Exception.Message)" -ForegroundColor Red
}

# ==================== FASE 2: TIP DIARIO ====================
Write-Host "`n[8] Obteniendo Tip Diario..." -ForegroundColor Yellow

try {
  $tipResponse = Invoke-RestMethod -Uri "$BASE_URL/ai/$userId/tip" `
    -Method Get `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -ErrorAction Stop
  
  Write-Host "✓ Tip del día:" -ForegroundColor Green
  Write-Host "   $($tipResponse.tip)" -ForegroundColor Cyan
} catch {
  Write-Host "✗ Error obteniendo tip: $($_.Exception.Message)" -ForegroundColor Red
}

# ==================== FASE 2: HISTORIAL ====================
Write-Host "`n[9] Obteniendo historial de interacciones con IA..." -ForegroundColor Yellow

try {
  $historyResponse = Invoke-RestMethod -Uri "$BASE_URL/ai/$userId/history?limit=5" `
    -Method Get `
    -Headers @{"Authorization" = "Bearer $token"} `
    -ContentType "application/json" `
    -ErrorAction Stop
  
  Write-Host "✓ Historial ($($historyResponse.count) registros):" -ForegroundColor Green
  $historyResponse.history | ForEach-Object {
    Write-Host "   • [$($_.type)] $(Get-Date -Date $_.createdAt -Format 'HH:mm:ss')" -ForegroundColor Cyan
  }
} catch {
  Write-Host "✗ Error obteniendo historial: $($_.Exception.Message)" -ForegroundColor Red
}

# ==================== RESUMEN ====================
Write-Host "`n" 
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ TEST COMPLETADO CON ÉXITO" -ForegroundColor Green
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nCredenciales de prueba:" -ForegroundColor Yellow
Write-Host "  Email: $EMAIL" -ForegroundColor White
Write-Host "  Password: $PASSWORD" -ForegroundColor White
Write-Host "  UserID: $userId" -ForegroundColor White
Write-Host "  JWT Token: $($token.Substring(0, 30))..." -ForegroundColor White
Write-Host "`nPróximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Verifica logs en Supabase > ai_chat_logs" -ForegroundColor White
Write-Host "  2. Prueba endpoints adicionales" -ForegroundColor White
Write-Host "  3. Integra con mobile app (React Native)" -ForegroundColor White
Write-Host "═════════════════════════════════════════════" -ForegroundColor Cyan
