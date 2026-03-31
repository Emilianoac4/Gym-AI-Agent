# GymAI - Documentación de Base de Datos

**Versión**: 2.0 (Fase 1 + Fase 2)  
**Database**: PostgreSQL (Supabase)  
**ORM**: Prisma 6.14.0  
**Timestamp**: Marzo 30, 2026  

---

## 📊 Diagrama ER (Entity Relationship)

```
┌──────────────┐
│    Gyms      │
│──────────────│
│ id (PK)      │◄──────────┐
│ name         │           │
│ ownerName    │           │
│ address      │           │ (1:N)
│ phone        │           │
│ createdAt    │           │
└──────────────┘           │
                           │
                    ┌──────┴───────┐
                    │              │
              ┌─────┴─────┐  ┌─────┴──────┐
              │   Users   │  │ (CASCADE)  │
              │───────────│  │            │
              │ id (PK)   │  │ Ensures    │
              │ gymId (FK)├──┤ no orphans │
              │ email (U) │  │ on delete  │
              │ passHash  │  │            │
              │ fullName  │  └────────────┘
              │ role      │
              │ createdAt │
              │ updatedAt │
              │ isActive  │
              └─────┬─────┘
                    │
         ┌──────────┴──────────┐
         │ (1:1 relationship)  │
         │                     │
    ┌────┴──────┐          ┌───┴──────┐
    │ UserProfile        Measurement
    │───────────│       │──────────────│
    │ id (PK)   │       │ id (PK)      │
    │ userId(FK)├─────┤ userId (FK)   │
    │ (UNIQUE)  │       │ date         │
    │ birthDate │       │ weightKg     │
    │ heightCm  │       │ bodyFatPct   │
    │ goal      │       │ muscleMass   │
    │ medConds  │       │ chestCm      │
    │ injuries  │       │ waistCm      │
    │ expLevel  │       │ hipCm        │
    │ availability      │ armCm        │
    │ dietPrefs │       │ photoUrl     │
    │ createdAt │       │ createdAt    │
    │ updatedAt │       └──────────────┘
    └───────────┘
         │
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌─────────────────┐  ┌──────────────────┐
│  AIChatLog      │  (Logged by all AI  │
│─────────────────│   endpoints for    │
│ id (PK)         │   audit trail)     │
│ userId (FK) ────┼──────────────────┐  │
│ type (ENUM)     │  CHAT            │  │
│ userMessage     │  ROUTINE_GEN     │  │
│ aiResponse      │  NUTRITION_GEN   │  │
│ createdAt       │  DAILY_TIP       │  │
└─────────────────┘                  │
                                    │
                    ┌───────────────┘
                    │
                    └─ Every AI interaction
```

---

## 📋 Tablas Modelo a Modelo

### 1️⃣ Tabla: `gyms`

**Propósito**: Almacenar información de gimnasios. Un gimnasio puede tener múltiples usuarios.

**Definición Prisma**:
```prisma
model Gym {
  id        String   @id @default(uuid())
  name      String
  ownerName String   @map("owner_name")
  address   String?
  phone     String?
  createdAt DateTime @default(now()) @map("created_at")

  users User[]

  @@map("gyms")
}
```

**SQL PostgreSQL**:
```sql
CREATE TABLE "public"."gyms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);
```

**Campos**:

| Campo | Tipo | Nulos | Índice | Descripción |
|-------|------|-------|--------|-------------|
| `id` | TEXT (UUID) | NO | PK | Identificador único |
| `name` | TEXT | NO | - | Nombre del gimnasio (e.g., "GymAI São Paulo") |
| `owner_name` | TEXT | NO | - | Nombre del propietario |
| `address` | TEXT | YES | - | Dirección física |
| `phone` | TEXT | YES | - | Teléfono de contacto |
| `created_at` | TIMESTAMP | NO | - | Fecha de creación (auto) |

**Relaciones**:
- `users[]` - Un gym tiene muchos usuarios

**Constraints**:
- Foreign Key en `users.gym_id` con `ON DELETE CASCADE`
  - Si se elimina gym, se eliminan sus usuarios

**Ejemplos de Datos**:
```json
{
  "id": "03ce9106-8c7c-4d2e-8e5c-1a2b3c4d5e6f",
  "name": "GymAI São Paulo",
  "ownerName": "João Silva",
  "address": "Avenida Paulista 1000",
  "phone": "+55 11 98765-4321",
  "createdAt": "2026-03-26T08:00:00.000Z"
}
```

**Queries Típicas**:
```typescript
// Crear gimnasio
await prisma.gym.create({
  data: {
    name: "GymAI Madrid",
    ownerName: "Carlos López",
    address: "Calle Gran Vía 100",
    phone: "+34 91 123-4567"
  }
});

// Obtener con usuarios
await prisma.gym.findUnique({
  where: { id: gymId },
  include: { users: true }
});

// Eliminar (cascada a usuarios)
await prisma.gym.delete({ where: { id: gymId } });
```

---

### 2️⃣ Tabla: `users`

**Propósito**: Autenticación y datos básicos del usuario. Nexo entre Gym y Profile/Measurements.

**Definición Prisma**:
```prisma
model User {
  id           String      @id @default(uuid())
  gymId        String      @map("gym_id")
  email        String      @unique
  passwordHash String      @map("password_hash")
  fullName     String      @map("full_name")
  role         UserRole    @default(member)
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  isActive     Boolean     @default(true) @map("is_active")

  gym          Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  profile      UserProfile?
  measurements Measurement[]

  @@map("users")
}

enum UserRole {
  admin
  member
}
```

**SQL PostgreSQL**:
```sql
CREATE TYPE "public"."UserRole" AS ENUM ('admin', 'member');

CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
ALTER TABLE "public"."users" ADD CONSTRAINT "users_gym_id_fkey" 
  FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Campos**:

| Campo | Tipo | Nulos | Índice | Descripción |
|-------|------|-------|--------|-------------|
| `id` | TEXT (UUID) | NO | PK | Identificador único |
| `gym_id` | TEXT (FK) | NO | - | Referencia al gimnasio |
| `email` | TEXT | NO | UNIQUE | Email (login único) |
| `password_hash` | TEXT | NO | - | Hash bcryptjs (salt: 12 rounds) |
| `full_name` | TEXT | NO | - | Nombre completo del usuario |
| `role` | ENUM | NO | - | Rol (admin/member) |
| `created_at` | TIMESTAMP | NO | - | Auto-timestamp creación |
| `updated_at` | TIMESTAMP | NO | - | Auto-timestamp actualización |
| `is_active` | BOOLEAN | NO | - | Si está activo (soft delete) |

**Relaciones**:
- `gym` - Pertenece a un Gym
- `profile` - Tiene 0 o 1 UserProfile
- `measurements[]` - Tiene N mediciones

**Constraints**:
- `email` UNIQUE - Previene duplicados
- `gym_id` FK CASCADE - Elimina usuario si gym se elimina

**Regla de Negocio**:
- Primer usuario de un gym → role = "admin"
- Usuarios posteriores → role = "member" (requiere admin token para crear)

**Ejemplos de Datos**:
```json
{
  "id": "fca8defc-43a3-4794-810f-f29493b86616",
  "gymId": "03ce9106-8c7c-4d2e-8e5c-1a2b3c4d5e6f",
  "email": "admin@gymiai.com",
  "passwordHash": "$2a$12$...(64 chars hash)...",
  "fullName": "Admin User",
  "role": "admin",
  "isActive": true,
  "createdAt": "2026-03-26T10:00:00.000Z",
  "updatedAt": "2026-03-26T10:00:00.000Z"
}
```

**Queries Típicas**:
```typescript
// Login
const user = await prisma.user.findunique({
  where: { email: "admin@gymiai.com" }
});

// Crear miembro
await prisma.user.create({
  data: {
    gymId,
    email: "member@gymiai.com",
    passwordHash: await hash(password, 12),
    fullName: "Member Name",
    role: "member"
  }
});

// Fetch con relaciones
await prisma.user.findUnique({
  where: { id: userId },
  include: { gym: true, profile: true, measurements: true }
});

// Contar activos por gym
await prisma.user.count({
  where: { gymId, isActive: true }
});
```

---

### 3️⃣ Tabla: `user_profiles`

**Propósito**: Datos vitales y preferencias del usuario. Información para generar rutinas y planes nutricionales.

**Definición Prisma**:
```prisma
model UserProfile {
  id             String    @id @default(uuid())
  userId         String    @unique @map("user_id")
  birthDate      DateTime? @map("birth_date")
  heightCm       Float?    @map("height_cm")
  goal           String?
  medicalConds   String?   @map("medical_conds")
  injuries       String?
  experienceLvl  String?   @map("experience_lvl")
  availability   String?
  dietPrefs      String?   @map("diet_prefs")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

**SQL PostgreSQL**:
```sql
CREATE TABLE "public"."user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "birth_date" TIMESTAMP(3),
    "height_cm" DOUBLE PRECISION,
    "goal" TEXT,
    "medical_conds" TEXT,
    "injuries" TEXT,
    "experience_lvl" TEXT,
    "availability" TEXT,
    "diet_prefs" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "public"."user_profiles"("user_id");
ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Campos**:

| Campo | Tipo | Nulos | Índice | Descripción |
|-------|------|-------|--------|-------------|
| `id` | TEXT (UUID) | NO | PK | Identificador único |
| `user_id` | TEXT (FK) | NO | UNIQUE | Foreign key a users |
| `birth_date` | TIMESTAMP | YES | - | Fecha de nacimiento |
| `height_cm` | FLOAT | YES | - | Altura en centímetros |
| `goal` | TEXT | YES | - | Objetivo fitness libre (ej: "Ganar músculo") |
| `medical_conds` | TEXT | YES | - | Condiciones médicas / alergias |
| `injuries` | TEXT | YES | - | Lesiones previas / actuales |
| `experience_lvl` | TEXT | YES | - | Nivel (Beginner/Intermediate/Advanced) |
| `availability` | TEXT | YES | - | Disponibilidad (ej: "4 días/semana") |
| `diet_prefs` | TEXT | YES | - | Preferencias dietéticas (ej: "Vegetariano") |
| `created_at` | TIMESTAMP | NO | - | Auto-timestamp |
| `updated_at` | TIMESTAMP | NO | - | Auto-timestamp |

**Relación**:
- `user` - Pertenece a exactamente un User (1:1)

**Constraint**:
- `user_id` UNIQUE - Solo 1 perfil por usuario
- `user_id` FK CASCADE - Eliminar perfil si user se elimina

**Ejemplos de Datos**:
```json
{
  "id": "5c11ee64-7dd2-4940-943f-31189137ba57",
  "userId": "fca8defc-43a3-4794-810f-f29493b86616",
  "birthDate": "1990-05-15T00:00:00.000Z",
  "heightCm": 175,
  "goal": "Perder grasa y ganar masa muscular",
  "medicalConds": "Ninguna",
  "injuries": "Ninguna",
  "experienceLvl": "Intermedio",
  "availability": "4 días por semana",
  "dietPrefs": "Sin lactosa",
  "createdAt": "2026-03-31T03:20:16.628Z",
  "updatedAt": "2026-03-31T03:20:16.628Z"
}
```

**Uso en IA**:
Cuando usuario solicita rutina, este profile se usa para:
```typescript
const context = {
  goal: profile.goal,                    // Personalizar objetivo
  experienceLevel: profile.experienceLvl,  // Ajustar intensidad
  availability: profile.availability,    // Sesiones por semana
  injuries: profile.injuries,            // Ejercicios a evitar
  medicalConditions: profile.medicalConds // Restricciones
};
// Enviado a OpenAI en el prompt
```

**Queries Típicas**:
```typescript
// Upsert (create or update)
await prisma.userProfile.upsert({
  where: { userId },
  update: { heightCm: 175, goal: "..." },
  create: { userId, heightCm: 175, goal: "..." }
});

// Obtener
await prisma.userProfile.findUnique({
  where: { userId }
});

// Actualizar
await prisma.userProfile.update({
  where: { userId },
  data: { heightCm: 180 }
});
```

---

### 4️⃣ Tabla: `measurements`

**Propósito**: Historial de mediciones anthropométricas. Permite tracking de progreso.

**Definición Prisma**:
```prisma
model Measurement {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  date       DateTime  @default(now())
  weightKg   Float?    @map("weight_kg")
  bodyFatPct Float?    @map("body_fat_pct")
  muscleMass Float?    @map("muscle_mass")
  chestCm    Float?    @map("chest_cm")
  waistCm    Float?    @map("waist_cm")
  hipCm      Float?    @map("hip_cm")
  armCm      Float?    @map("arm_cm")
  photoUrl   String?   @map("photo_url")
  createdAt  DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("measurements")
}
```

**SQL PostgreSQL**:
```sql
CREATE TABLE "public"."measurements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight_kg" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "muscle_mass" DOUBLE PRECISION,
    "chest_cm" DOUBLE PRECISION,
    "waist_cm" DOUBLE PRECISION,
    "hip_cm" DOUBLE PRECISION,
    "arm_cm" DOUBLE PRECISION,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."measurements" ADD CONSTRAINT "measurements_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Campos**:

| Campo | Tipo | Nulos | Descripción |
|-------|------|-------|-------------|
| `id` | TEXT (UUID) | NO | Identificador único |
| `user_id` | TEXT (FK) | NO | Referencia al usuario |
| `date` | TIMESTAMP | NO | Fecha de la medición |
| `weight_kg` | FLOAT | YES | Peso en kilogramos |
| `body_fat_pct` | FLOAT | YES | Porcentaje de grasa corporal |
| `muscle_mass` | FLOAT | YES | Masa muscular en kg |
| `chest_cm` | FLOAT | YES | Circunferencia de pecho en cm |
| `waist_cm` | FLOAT | YES | Circunferencia de cintura en cm |
| `hip_cm` | FLOAT | YES | Circunferencia de cadera en cm |
| `arm_cm` | FLOAT | YES | Circunferencia de brazo en cm |
| `photo_url` | TEXT | YES | URL de foto antes/después |
| `created_at` | TIMESTAMP | NO | Timestamp de creación |

**Relación**:
- `user` - Pertenece a exactamente un User

**Constraint**:
- `user_id` FK CASCADE - Eliminar mediciones si user se elimina

**Ejemplos de Datos**:
```json
{
  "id": "abc12345-def6-789g-hij0-klmnopqrstuv",
  "userId": "fca8defc-43a3-4794-810f-f29493b86616",
  "date": "2026-03-31T08:30:00.000Z",
  "weightKg": 82,
  "bodyFatPct": 22,
  "muscleMass": 60,
  "chestCm": 100,
  "waistCm": 85,
  "hipCm": 95,
  "armCm": 35,
  "photoUrl": "https://s3.../photos/user1_day1.jpg",
  "createdAt": "2026-03-31T08:30:00.000Z"
}
```

**Queries Típicas**:
```typescript
// Crear medición
await prisma.measurement.create({
  data: {
    userId,
    date: new Date(),
    weightKg: 82,
    bodyFatPct: 22,
    // ...más campos
  }
});

// Obtener últimas N mediciones
await prisma.measurement.findMany({
  where: { userId },
  orderBy: { date: "desc" },
  take: 10
});

// Calcular progreso (trend analysis Fase 3)
const first = await prisma.measurement.findFirst({
  where: { userId },
  orderBy: { date: "asc" }
});
const last = await prisma.measurement.findFirst({
  where: { userId },
  orderBy: { date: "desc" }
});
const weightProgress = last.weightKg - first.weightKg;
```

---

### 5️⃣ Tabla: `ai_chat_logs` (Fase 2)

**Propósito**: Audit trail y logging de todas las interacciones con IA.

**Definición Prisma**:
```prisma
enum AIChatLogType {
  CHAT
  ROUTINE_GENERATION
  NUTRITION_GENERATION
  DAILY_TIP
}

model AIChatLog {
  id          String        @id @default(uuid())
  userId      String        @map("user_id")
  type        AIChatLogType
  userMessage String        @map("user_message")
  aiResponse  String        @map("ai_response")
  createdAt   DateTime      @default(now()) @map("created_at")

  @@map("ai_chat_logs")
}
```

**SQL PostgreSQL**:
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

**Campos**:

| Campo | Tipo | Nulos | Descripción |
|-------|------|-------|-------------|
| `id` | TEXT (UUID) | NO | Identificador único |
| `user_id` | TEXT | NO | Usuario que hizo la solicitud |
| `type` | ENUM | NO | Tipo de interacción (ver abajo) |
| `user_message` | TEXT | NO | Prompt/mensaje enviado (primeros 500 chars) |
| `ai_response` | TEXT | NO | Respuesta recibida (primeros 1000 chars) |
| `created_at` | TIMESTAMP | NO | Auto-timestamp |

**Enum AIChatLogType**:
```
CHAT                    → Chat libre con coach
ROUTINE_GENERATION      → GenerateRoutine
NUTRITION_GENERATION    → GenerateNutritionPlan
DAILY_TIP               → GenerateDailyTip
```

**Ejemplos de Datos**:
```json
{
  "id": "log-uuid-001",
  "userId": "fca8defc-43a3-4794-810f-f29493b86616",
  "type": "ROUTINE_GENERATION",
  "userMessage": "You are an expert fitness coach. Based on the following user profile...",
  "aiResponse": "{\"routine_name\": \"Strength Building\", \"duration_weeks\": 8, ...}",
  "createdAt": "2026-03-31T10:30:00.000Z"
}
```

**Queries Típicas**:
```typescript
// Log automático en cada llamada IA
await prisma.aIChatLog.create({
  data: {
    userId,
    type: "ROUTINE_GENERATION",
    userMessage: prompt.substring(0, 500),
    aiResponse: response.substring(0, 1000)
  }
});

// Obtener historial
await prisma.aIChatLog.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
  take: 20
});

// Análisis: cuántas rutinas generó user
await prisma.aIChatLog.count({
  where: {
    userId,
    type: "ROUTINE_GENERATION"
  }
});
```

---

## 🔑 Índices y Performance

**Índices Existentes**:
```sql
-- PK (automáticos)
CREATE UNIQUE INDEX "gyms_pkey" ON "public"."gyms"("id");
CREATE UNIQUE INDEX "users_pkey" ON "public"."users"("id");
CREATE UNIQUE INDEX "user_profiles_pkey" ON "public"."user_profiles"("id");
CREATE UNIQUE INDEX "measurements_pkey" ON "public"."measurements"("id");
CREATE UNIQUE INDEX "ai_chat_logs_pkey" ON "public"."ai_chat_logs"("id");

-- Business logic índices
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "public"."user_profiles"("user_id");
```

**Recomendaciones (Fase 3)**:
```sql
-- Speedup búsquedas frecuentes
CREATE INDEX "idx_users_gym_id" ON "public"."users"("gym_id");
CREATE INDEX "idx_measurements_user_date" ON "public"."measurements"("user_id", "date" DESC);
CREATE INDEX "idx_ai_chat_logs_user_created" ON "public"."ai_chat_logs"("user_id", "created_at" DESC);

-- Full-text search (futuro)
CREATE INDEX "idx_users_full_name_gin" ON "public"."users" USING gin(to_tsvector('english', "full_name"));
```

---

## 🔗 Relaciones y Constraints

### Cascading Deletes

```
DELETE FROM gyms WHERE id = X
  ↓
DELETE FROM users WHERE gym_id = X
  ↓
DELETE FROM user_profiles WHERE user_id IN (...)
DELETE FROM measurements WHERE user_id IN (...)
DELETE FROM ai_chat_logs WHERE user_id IN (...)
```

**Implicación**: Eliminar un gym borra TODO. Use soft delete para producción.

---

## 📊 Estadísticas de Datos

**Estimaciones de Size (1000 usuarios)**:
```
gyms                     ~1 MB
users                    ~2 MB
user_profiles            ~2 MB
measurements (10 per user) ~3 MB
ai_chat_logs (50 per user) ~100 MB
────────────────────────────────
TOTAL                    ~108 MB
```

**Con 100K usuarios**: ~10 GB (manejable en Supabase)

---

## 🛡️ Integridad de Datos

### Foreign Keys
```sql
✅ Vigentes:
- users.gym_id → gyms.id (CASCADE)
- user_profiles.user_id → users.id (CASCADE)
- measurements.user_id → users.id (CASCADE)
```

### Unique Constraints
```sql
✅ Vigentes:
- users.email - Previene registro duplicado
- user_profiles.user_id - Solo 1 profile per user
```

### Not Null Constraints
```sql
✅ Vigentes en campos críticos:
- users: email, passwordHash, fullName, role, gymId
- user_profiles: userId
- measurements: userId, date
- ai_chat_logs: userId, type, userMessage, aiResponse
```

---

## 🔄 Migrations

### Fase 1 Setup
**Archivo**: `prisma/init_supabase.sql`  
**Contenido**: Crea gyms, users, user_profiles, measurements tables

### Fase 2 Setup
**Archivo**: `prisma/add_ai_chat_logs_only.sql`  
**Contenido**: Crea AIChatLogType enum y ai_chat_logs table

### Cómo Aplicar
```bash
# Copiar SQL desde archivo
# Acceder a: https://app.supabase.com → [Project] → SQL Editor
# Pegar y ejecutar (conexión automática si dashboard)

# O via Supabase CLI:
supabase db push
```

---

## 📚 Queries de Ejemplo Para Testing

```sql
-- Usuarios activos por gym
SELECT gyms.name, COUNT(users.id) as total_users
FROM gyms
LEFT JOIN users ON users.gym_id = gyms.id
WHERE users.is_active = true
GROUP BY gyms.id;

-- Últimas mediciones (últimos 7 días)
SELECT users.full_name, measurements.*
FROM measurements
JOIN users ON measurements.user_id = users.id
WHERE measurements.date > NOW() - INTERVAL '7 days'
ORDER BY measurements.date DESC;

-- Perfiles incompletos
SELECT users.id, users.email
FROM users
LEFT JOIN user_profiles ON user_profiles.user_id = users.id
WHERE user_profiles.id IS NULL
AND users.is_active = true;

-- Distribución de roles
SELECT role, COUNT(*) as count
FROM users
WHERE is_active = true
GROUP BY role;

-- Actividad IA (últimas 24h)
SELECT type, COUNT(*) as count
FROM ai_chat_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY type;
```

---

## ⚠️ Consideraciones de Migración (Fase 3+)

**Si agregar campos nuevos**:
```typescript
// 1. Editar schema.prisma
model User {
  // ... existing fields
  newField String?  // Nullable para backward compat
}

// 2. Generar migration
npm run prisma:generate

// 3. Deploy a Supabase (automático con Prisma Client)
// O manual SQL
```

**Si renombrar campo**:
```prisma
// Hacer 2-step rename para evitar data loss
model User {
  oldField String?    // Mantener
  newField String?    // Agregar
  // Vs. direct: oldField -> newField
}
```

---

**Documento actualizado**: Marzo 30, 2026  
**Mantenido por**: Data Architecture Team
