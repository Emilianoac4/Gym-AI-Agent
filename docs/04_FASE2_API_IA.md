# Fase 2: Integración IA - Endpoints API

## 📋 Resumen

Fase 2 implementa integración con OpenAI para generar:
- Rutinas de entrenamiento personalizadas
- Planes nutricionales personalizados  
- Chat libre con coach de IA
- Tips de fitness diarios
- Historial de interacciones con IA

## 🔑 Requerimientos

### 1. Configurar OpenAI API Key

En `.env`, actualiza:
```env
OPENAI_API_KEY="sk-your-real-openai-api-key-here"
```

Obtén tu clave en: https://platform.openai.com/api-keys

### 2. Crear tabla en Supabase

Ejecuta en **Supabase > SQL Editor**:

```sql
CREATE TYPE "public"."AIChatLogType" AS ENUM ('CHAT', 'ROUTINE_GENERATION', 'NUTRITION_GENERATION', 'DAILY_TIP');

CREATE TABLE "public"."ai_chat_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "public"."AIChatLogType" NOT NULL,
    "user_message" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_chat_logs_pkey" PRIMARY KEY ("id")
);
```

## 📡 Endpoints

### 1. Generar Rutina Personalizada

**POST** `/ai/:userId/routine`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response:**
```json
{
  "message": "Routine generated successfully",
  "routine": {
    "routine_name": "Strength Building - 4 Days/Week",
    "duration_weeks": 8,
    "weekly_sessions": 4,
    "sessions": [
      {
        "day": "Monday",
        "focus": "Upper Body Push",
        "duration_minutes": 60,
        "exercises": [
          {
            "name": "Bench Press",
            "sets": 4,
            "reps": "6-8",
            "rest_seconds": 180,
            "notes": "Warm up with 2 sets of 10 reps"
          }
        ]
      }
    ],
    "progression_tips": ["Increase weight by 5% weekly", "Maintain form over load"],
    "nutrition_notes": "Ensure 1.8g protein per kg bodyweight daily"
  }
}
```

### 2. Generar Plan Nutricional

**POST** `/ai/:userId/nutrition`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Response:**
```json
{
  "message": "Nutrition plan generated successfully",
  "plan": {
    "plan_name": "Muscle Gain - 2800 Cal",
    "daily_calories": 2800,
    "macros": {
      "protein_g": 160,
      "carbs_g": 280,
      "fats_g": 93
    },
    "meal_plan": [
      {
        "meal": "Breakfast",
        "options": ["Oatmeal with eggs and berries"],
        "macros": {"protein_g": 25, "carbs_g": 60, "fats_g": 10}
      }
    ],
    "hydration_tips": "Drink at least 3L water daily",
    "supplement_notes": "Consider Creatine 5g/day",
    "shopping_list": ["Chicken breast", "Rice", "Eggs", "Broccoli"]
  }
}
```

### 3. Chat Libre con Coach IA

**POST** `/ai/:userId/chat`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "message": "¿Cuál es la mejor forma de hacer sentadillas?"
}
```

**Response:**
```json
{
  "message": "Chat response received",
  "response": "Las sentadillas son un ejercicio fundamental... [respuesta IA extendida]"
}
```

### 4. Obtener Tip Diario

**GET** `/ai/:userId/tip`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Daily tip generated",
  "tip": "Recuerda que la consistencia es más importante que la perfección. Hoy, enfócate en completar tu rutina sin importar la dificultad."
}
```

### 5. Obtener Historial de Chat

**GET** `/ai/:userId/history?limit=20`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Chat history retrieved",
  "count": 3,
  "history": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "CHAT",
      "userMessage": "¿Cuál es la mejor forma de hacer sentadillas?",
      "aiResponse": "Las sentadillas...",
      "createdAt": "2026-03-31T10:30:00.000Z"
    }
  ]
}
```

## 🧪 Ejemplos de Prueba (PowerShell)

### 1. Generar Rutina

```powershell
$token = "YOUR_JWT_TOKEN"
$userId = "YOUR_USER_ID"

$routine = Invoke-RestMethod -Uri "http://localhost:3000/ai/$userId/routine" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json"

$routine | ConvertTo-Json -Depth 10
```

### 2. Generar Nutrición

```powershell
$plan = Invoke-RestMethod -Uri "http://localhost:3000/ai/$userId/nutrition" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json"

$plan | ConvertTo-Json -Depth 10
```

### 3. Chat

```powershell
$body = @{
  message = "¿Cómo mejoro mi fuerza en las piernas?"
} | ConvertTo-Json

$chat = Invoke-RestMethod -Uri "http://localhost:3000/ai/$userId/chat" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
  -Body $body

$chat.response
```

### 4. Tip Diario

```powershell
$tip = Invoke-RestMethod -Uri "http://localhost:3000/ai/$userId/tip" `
  -Method Get `
  -Headers @{"Authorization"="Bearer $token"}

$tip.tip
```

### 5. Historial

```powershell
$history = Invoke-RestMethod -Uri "http://localhost:3000/ai/$userId/history?limit=10" `
  -Method Get `
  -Headers @{"Authorization"="Bearer $token"}

$history.history | ConvertTo-Json -Depth 5
```

## ⚙️ Configuración OpenAI

### Modelos utilizados

- **Routines & Nutrition**: `gpt-4` (más preciso para JSON estructurado)
- **Chat & Tips**: `gpt-3.5-turbo` (más rápido y económico)

### Límites recomendados

- Max tokens por routine/nutrition: 2000
- Max tokens por chat/tip: 800
- Temperatura: 0.7-0.8 (Respuestas creativas pero consistentes)

## 📊 Datos registrados

Todas las interacciones se guardan en `ai_chat_logs`:
- `type`: Tipo de interacción (CHAT, ROUTINE_GENERATION, NUTRITION_GENERATION, DAILY_TIP)
- `userMessage`: Prompt enviado a IA
- `aiResponse`: Respuesta recibida (primeros 1000 caracteres)
- `createdAt`: Timestamp automático

## 🔐 Seguridad

✅ Todo endpoint requiere JWT token válido
✅ Usuarios pueden solo acceder a sus propias rutinas/chats (members)
✅ Admins pueden acceder a cualquier usuario
✅ Logs trimmed a 1000 chars para evitar sobrecarga en DB

## ❌ Posibles Errores

### 401 - Unauthorized
```json
{"statusCode": 401, "message": "Invalid or expired token"}
```
→ JWT token vencido o inválido

### 403 - Forbidden
```json
{"statusCode": 403, "message": "Forbidden"}
```
→ Usuario intenta acceder a datos de otro usuario (solo admin puede)

### 404 - User Not Found
```json
{"statusCode": 404, "message": "User not found"}
```
→ UserId inválido

### 400 - Profile Incomplete
```json
{"statusCode": 400, "message": "User profile not complete. Please fill your profile first."}
```
→ Usuario no ha completado su perfil (altura, goal, etc)

### 429 - Rate Limited (OpenAI)
→ Demasiadas llamadas a OpenAI. Implementar caché / retry logic en Fase 3

## 🚀 Próximas Mejoras (Fase 3)

- [ ] Caché local para rutinas similares
- [ ] Rate limiting por usuario
- [ ] Webhook para procesamiento async
- [ ] Integración con datos reales de mediciones
- [ ] Alert system basado en progreso
- [ ] Mobile app (React Native)

