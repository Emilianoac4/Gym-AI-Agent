# GymAI - Backend (Fase 1 + Fase 2)

## 📌 Status

✅ **Fase 1 (Fundamentos)**
- [x] TypeScript + Express API
- [x] Prisma ORM con PostgreSQL (Supabase)
- [x] JWT Authentication
- [x] User Management
- [x] Profile Management
- [x] Measurement Tracking

✅ **Fase 2 (IA)**
- [x] OpenAI Integration
- [x] Routine Generation
- [x] Nutrition Plan Generation
- [x] Chat Coach
- [x] Daily Tips
- [x] AI Interaction Logging

## 🚀 Quick Start

### 1. Instalar dependencias
```bash
cd backend
npm install
```

### 2. Configurar variables de entorno
```bash
# Copia .env.example a .env (ya existe)
# Actualiza:
OPENAI_API_KEY="sk-your-openai-api-key-here"  # Get from https://platform.openai.com/api-keys
PORT=3000
```

### 3. Crear tablas en Supabase
Ve a [Supabase SQL Editor](https://app.supabase.com) y ejecuta:

```sql
-- Fase 1: Ya existe
-- (gyms, users, user_profiles, measurements)

-- Fase 2: Agregar IA
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

### 4. Iniciar servidor
```bash
npm run dev
# Server activo en http://localhost:3000
```

## 📡 Endpoints Disponibles

### Autenticación (Fase 1)
- `POST /auth/register` - Registro nuevo
- `POST /auth/login` - Login y generar JWT

### Usuarios (Fase 1)
- `GET /users/:id/profile` - Obtener perfil
- `PUT /users/:id/profile` - Actualizar perfil

### Mediciones (Fase 1)
- `POST /users/:id/measurements` - Crear medición
- `GET /users/:id/measurements` - Listar mediciones

### IA (Fase 2)
- `POST /ai/:userId/routine` - Generar rutina
- `POST /ai/:userId/nutrition` - Generar plan nutricional
- `POST /ai/:userId/chat` - Chat con IA
- `GET /ai/:userId/tip` - Obtener tip diario
- `GET /ai/:userId/history` - Historial de interacciones

## 🧪 Testing Completo

Ejecuta el script de prueba que crea un usuario y prueba todo:

```powershell
# PowerShell
cd c:\APPS_EAC\Agente_Gym\backend
./test-complete-flow.ps1
```

Script incluye:
1. Verificación del servidor
2. Registro de usuario
3. Login
4. Actualización de perfil
5. Generación de rutina (IA)
6. Generación de plan nutricional (IA)
7. Chat con Coach IA
8. Obtención de tip diario
9. Historial de interacciones

## 📊 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/              # Config (env, prisma, etc)
│   ├── middleware/          # Express middlewares
│   ├── modules/
│   │   ├── auth/            # Autenticación
│   │   ├── users/           # Usuarios y perfiles
│   │   ├── measurements/    # Mediciones
│   │   └── ai/              # Fase 2: OpenAI integration
│   │       ├── ai.service.ts    # Servicio OpenAI
│   │       ├── ai.controller.ts # Controllers
│   │       ├── ai.routes.ts     # Rutas
│   │       └── ai.validation.ts # Validaciones Zod
│   ├── types/               # TypeScript types
│   ├── utils/               # Utilities (JWT, errors, etc)
│   ├── app.ts               # Express app
│   └── server.ts            # Entry point
├── prisma/
│   ├── schema.prisma        # Data models
│   ├── init_supabase.sql    # Initial migration (Fase 1)
│   └── add_ai_chat_logs_only.sql  # Fase 2 migration
├── .env                     # Environment variables
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies
└── test-complete-flow.ps1   # Test script
```

## 🔐 Autenticación

### Flujo

1. **Registro**: `POST /auth/register`
   - Primer usuario de gym = admin automáticamente
   - Usuarios posteriores requieren token de admin
   - Password hasheado con bcryptjs (salt: 12 rounds)

2. **Login**: `POST /auth/login`
   - Retorna JWT con payload: `{ userId, role }`
   - Expira en 1 hora
   - Usar en `Authorization: Bearer <token>`

3. **Autorización**:
   - Rutas protegidas validan token
   - Members acceden solo a sus datos
   - Admins acceden a todo

## 🤖 Servicios IA

### OpenAI Integration

**Modelos usados:**
- `gpt-4o-mini` por defecto para rutina, nutricion, chat y tips (configurable por variable de entorno)

**Prompt Engineering:**
- Contexto del usuario (perfil, lesiones, metas)
- Restricciones médicas consideradas
- Respuestas en formato JSON (parseable)
- Logging automático de interacciones

**Límites:**
- Max 2000 tokens por rutina/nutrición
- Max 800 tokens por chat (configurable con `OPENAI_CHAT_MAX_TOKENS`)
- Temperatura 0.7-0.8 (respuestas creativas)

**Memoria conversacional (Fase A):**
- El endpoint de chat inyecta una ventana de historial reciente del usuario para dar continuidad a la conversación.
- Variables de control: `OPENAI_CHAT_CONTEXT_TURNS`, `OPENAI_CHAT_CONTEXT_MAX_CHARS`, `OPENAI_CHAT_MAX_TOKENS`.

## 💾 Base de Datos

### Modelos (Prisma)

**Gym**
- `id` (UUID)
- `name`, `ownerName`, `address`, `phone`
- Relación: users[]

**User**
- `id` (UUID)
- `gymId` (FK)
- `email` (unique)
- `passwordHash`, `fullName`
- `role` (admin / member)
- `isActive`
- Relaciones: gym, profile, measurements

**UserProfile**
- `id` (UUID)
- `userId` (unique FK)
- Datos: birth date, height, goal, medical conditions, experience level
- Preferencias: availability, diet prefs

**Measurement**
- `id` (UUID)
- `userId` (FK)
- Datos: weight, body fat %, muscle mass, circumferences (chest, waist, hip, arm)
- `date`, `photoUrl`

**AIChatLog** (Fase 2)
- `id` (UUID)
- `userId` (FK)
- `type` (CHAT, ROUTINE_GENERATION, NUTRITION_GENERATION, DAILY_TIP)
- `userMessage`, `aiResponse` (truncados a 1000 chars)
- `createdAt`

## 📋 TypeScript & Build

```bash
# Validar tipos
npm run typecheck

# Compilar a JavaScript
npm run build

# Generar cliente Prisma
npm run prisma:generate

## Scripts NPM

```bash
npm run dev          # Start dev server (with hot reload)
npm run build        # Compile TypeScript to JS
npm run start        # Run compiled JavaScript
npm run typecheck    # Validate TypeScript
npm run prisma:generate  # Update Prisma client
```

## 🛠️ Desarrollo

### Variable de Entorno Importante

**Intel VPN**: Si estás detrás de proxy corporativo:
```bash
$env:HTTP_PROXY="http://proxy-iil.intel.com:911"
$env:HTTPS_PROXY="http://proxy-iil.intel.com:911"

# O usar npm directamente con flags:
npm install --proxy=http://proxy-iil.intel.com:911
```

**Desconecta VPN** para conectar a Supabase directamente.

### Prisma Workflow

```bash
# Actualizar schema
# → Editar prisma/schema.prisma

# Generar SQL
npm run prisma:generate

# Ejecutar en Supabase
# → SQL Editor de Supabase

# Regenerar cliente
npm run prisma:generate
```

##❌ Solución de Problemas

### "OPENAI_API_KEY is not set"
→ Configura `OPENAI_API_KEY` en `.env` con tu clave real desde https://platform.openai.com

### "User profile not complete"
→ Actualiza perfil primero: `PUT /users/:id/profile` con todos los campos

### "Invalid or expired token"
→ Token JWT expiró (1 hora). Haz login nuevamente

### "Cannot connect to database"
→ Desconecta Intel VPN o configura el pool de conexión de Supabase

## 🚀 Próximos Pasos

### Fase 3 (Próxima)
- [ ] Caché para rutinas similares
- [ ] Rate limiting por usuario
- [ ] Webhook para procesamiento async
- [ ] Sistema de alertas
- [ ] Mobile app (React Native)

### Consideraciones Productivas
- [ ] Renovar `JWT_SECRET` con valor seguro
- [ ] Implementar refresh tokens
- [ ] Agregar logging centralizad
- [ ] Rate limiting en OpenAI
- [ ] Monitoreo de errores (Sentry)
- [ ] CI/CD pipeline

## 📚 Documentación

- [Fase 2 API Completa](../docs/04_FASE2_API_IA.md)
- [Plan de Desarrollo](../docs/01_PLAN_DE_DESARROLLO.md)
- [Arquitectura](../docs/02_ARQUITECTURA.md)
- [Roadmap Técnico](../docs/03_ROADMAP_TECNICO.md)

## 📞 Info de Contacto

**Proyecto**: GymAI - AI-Powered Gym Management
**Status**: Fase 2 ✅ Completa
**Next**: Fase 3 - Mobile App & Webhooks
