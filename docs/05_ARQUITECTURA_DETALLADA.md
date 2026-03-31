# GymAI - Arquitectura General del Sistema

**Versión**: 2.0 (Fase 1 + Fase 2)  
**Fecha**: Marzo 30, 2026  
**Status**: Producción (Ready for Fase 3)  

---

## 📐 Visión General de la Arquitectura

GymAI es una plataforma de gestión de gimnasios con inteligencia artificial. La arquitectura está diseñada con separación de capas, modularidad y escalabilidad en mente.

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Fase 3)                     │
│              React Native Mobile App                    │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│              BACKEND (Node.js + Express)                │
│  ┌────────────┬──────────────┬────────────┬──────────┐  │
│  │   Auth     │    Users     │ Routines   │   Chat   │  │
│  │  Module    │   Module     │   Module   │ Module   │  │
│  │            │              │   (IA)     │  (IA)    │  │
│  └────────────┴──────────────┴────────────┴──────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Middleware Layer                       │   │
│  │  Auth • Validation • Error Handling • Logging    │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │ Database│  │ OpenAI    │  │ Logging  │
   │Supabase │  │   API     │  │ (Fase 3) │
   │PostgreSQL  │ (gpt-4)   │  │ Sentry   │
   └─────────┘  └───────────┘  └──────────┘
```

---

## 🏗️ Capas de la Arquitectura

### 1. **Layer Controller** (HTTP Request Handling)
Responsabilidades:
- Recibir requests HTTP
- Extraer parámetros y body
- Llamar servicios
- Retornar responses JSON
- Manejo de errores

**Ubicación**: `src/modules/*/[nombre].controller.ts`

**Ejemplo**:
```typescript
static async generateRoutine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId as string;
    // Validación → Servicio → Respuesta
    const routine = await aiService.generateRoutine(userId, context);
    res.json({ message: "Success", routine });
  } catch (error) {
    next(error); // Error handler
  }
}
```

### 2. **Layer Service** (Business Logic)
Responsabilidades:
- Lógica de negocio
- Orquestación de datos
- Integración con APIs externas (OpenAI)
- Transformación de datos

**Ubicación**: `src/modules/*/[nombre].service.ts`

**Ejemplo**:
```typescript
async generateRoutine(userId: string, context: UserContext): Promise<string> {
  const prompt = buildPrompt(context);
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });
  await logInteraction(userId, "ROUTINE_GENERATION", prompt, response);
  return response.choices[0].message.content;
}
```

### 3. **Layer Persistence** (Database Access)
Responsabilidades:
- Acceso a datos
- Queries a la BD
- Validación de constraints
- Transacciones

**Herramienta**: Prisma ORM
**Ubicación**: Controllers/Services usan `prisma.model.findUnique()`, etc.

**Flujo**:
```
Service → Prisma Client → PostgreSQL (Supabase)
```

### 4. **Layer Middleware** (Cross-Cutting Concerns)
Responsabilidades:
- Autenticación (JWT)
- Validación de schemas (Zod)
- Manejo de errores global
- Logging (futuro)
- CORS

**Ubicación**: `src/middleware/`

**Stack**:
```typescript
app.use(cors());
app.use(express.json());
app.get("/health", healthCheck);
app.use("/auth", authRouter);           // Sin protección
app.use("/users", authenticate, usersRouter);  // Protegido
app.use(notFoundHandler);
app.use(errorHandler);                  // Captura todo
```

### 5. **Layer Config** (Environment & Setup)
Responsabilidades:
- Variables de entorno
- Inicialización de clientes (Prisma, OpenAI)
- Configuración de la app

**Ubicación**: `src/config/`

**Archivos**:
- `env.ts` - Validación de ENV vars con Zod
- `prisma.ts` - PrismaClient singleton
- `database.ts` (futuro) - Pool de conexiones

---

## 📦 Módulos Principales

### Módulo: **Auth**

**Responsabilidad**: Gestionar registro, login, generación de tokens

**Archivos**:
```
src/modules/auth/
├── auth.controller.ts    # POST /auth/register, POST /auth/login
├── auth.routes.ts        # Rutas sin protección
└── auth.validation.ts    # Schemas Zod
```

**Flujo de Registro**:
```
1. POST /auth/register
   ├─ Validar payload (email, password, fullName)
   ├─ Crear Gym (si es primer usuario)
   ├─ Hash password (bcryptjs)
   ├─ Crear User en BD
   ├─ Rol = admin (primer usuario), member (posteriores)
   └─ Response: { user, message }
```

**Flujo de Login**:
```
1. POST /auth/login
   ├─ Validar credenciales
   ├─ Buscar usuario por email
   ├─ Comparar password con hash
   ├─ Generar JWT (userId + role, expiry 1h)
   └─ Response: { token, user }
```

### Módulo: **Users**

**Responsabilidad**: Gestionar perfiles de usuarios

**Archivos**:
```
src/modules/users/
├── users.controller.ts   # GET/PUT /users/:id/profile
├── users.routes.ts       # Rutas con protección
└── users.validation.ts   # Schemas perfil
```

**Entidades**:
- `User` - Básico (email, fullName, role)
- `UserProfile` - Datos vitales (altura, objetivo, lesiones, etc)

**Flujo GET Profile**:
```
1. GET /users/:id/profile
   ├─ Validar JWT
   ├─ Autorizar (member solo su data, admin todo)
   ├─ Fetch User + Profile
   └─ Response: { user, profile }
```

**Flujo PUT Profile**:
```
1. PUT /users/:id/profile
   ├─ Validar JWT
   ├─ Validar payload (Zod)
   ├─ Upsert ProfileUser
   └─ Response: { message, profile }
```

### Módulo: **Measurements**

**Responsabilidad**: Gestionar mediciones anthropométricas

**Archivos**:
```
src/modules/measurements/
├── measurements.controller.ts
├── measurements.routes.ts
└── measurements.validation.ts
```

**Flujo POST Measurement**:
```
1. POST /users/:id/measurements
   ├─ Validar JWT
   ├─ Validar payload (peso, body fat %, etc)
   ├─ Insert Measurement record
   └─ Response: { message, measurement }
```

**Flujo GET Measurements**:
```
1. GET /users/:id/measurements
   ├─ Validar JWT
   ├─ Fetch all measurements para usuario
   ├─ Ordenar por date DESC
   └─ Response: { measurements, count }
```

### Módulo: **AI** (Fase 2)

**Responsabilidad**: Integración con OpenAI para rutinas, nutrición, chat

**Archivos**:
```
src/modules/ai/
├── ai.controller.ts      # Endpoints IA
├── ai.service.ts         # Orquestación OpenAI
├── ai.routes.ts          # Rutas con autenticación
└── ai.validation.ts      # Schemas (e.g., chat messages)
```

**Servicios**:
- `generateRoutine()` - Rutina personalizada (gpt-4)
- `generateNutritionPlan()` - Plan nutricional (gpt-4)
- `chat()` - Chat libre (gpt-3.5-turbo)
- `generateDailyTip()` - Tips (gpt-3.5-turbo)

**Flujo POST /ai/:userId/routine**:
```
1. Validar JWT
2. Fetch UserProfile para contexto
3. Build prompt con datos usuario
4. Call OpenAI GPT-4
5. Parse respuesta JSON
6. Log interacción en ai_chat_logs
7. Response con rutina
```

---

## 🔐 Flujos de Seguridad

### Autenticación (JWT)

**Estructura del Token**:
```typescript
{
  userId: string;     // UUID usuario
  role: "admin" | "member";
  iat: number;        // Issued at (timestamp)
  exp: number;        // Expires at (iat + 3600 seconds)
}
```

**Generación**:
```typescript
const token = jwt.sign(
  { userId, role },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);
```

**Validación middleware**:
```typescript
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing token"));
    return;
  }
  
  const token = authHeader.slice(7);
  const payload = verifyAuthToken(token);  // Throws if invalid
  req.auth = payload;
  next();
};
```

### Autorización (Role-Based Access Control)

**Pattern**:
```typescript
// En controller
if (auth.role !== "admin" && auth.userId !== userId) {
  throw new HttpError(403, "Forbidden");
}
```

**Reglas**:
| Recurso | Member | Admin |
|---------|--------|-------|
| Own profile | ✅ R/W | ✅ R/W |
| Other profile | ❌ | ✅ R/W |
| Own measurements | ✅ R/W | ✅ R/W |
| Other measurements | ❌ | ✅ R |
| Routine generation | ✅ (own) | ✅ (any) |
| Chat history | ✅ (own) | ✅ (any) |

---

## 🗄️ Data Flow

### Ejemplo: Usuario solicita rutina personalizada

```
1. FRONTEND
   POST /ai/userId/routine
   Header: Authorization: Bearer eyJ...
   
2. BACKEND - Express
   ├─ Parser JSON body
   └─ Route: aiRouter.post("/:userId/routine")
   
3. MIDDLEWARE
   ├─ authenticate() - Valida JWT
   ├─ Extrae userId, role de token
   └─ Autoriza (role !== "admin" && userId !== pathUserId)
   
4. CONTROLLER
   ├─ Valida userId param
   ├─ Fetch User + UserProfile desde Prisma
   ├─ Chequea que profile existe (sino error 400)
   └─ Llama aiService.generateRoutine()
   
5. SERVICE
   ├─ Build prompt con contexto usuario
   ├─ Call OpenAI GPT-4 API
   │  └─ Espera respuesta con routine JSON
   ├─ Parse respuesta
   ├─ Log interacción en ai_chat_logs (Prisma)
   └─ Return routine JSON string
   
6. CONTROLLER (cont)
   ├─ Parse routine JSON
   ├─ Construir response
   └─ res.json({ message, routine })
   
7. RESPONSE
   200 OK
   {
     "message": "Routine generated successfully",
     "routine": { ... }
   }
```

---

## 📊 Tech Stack

| Capa | Tecnología | Versión | Razón |
|------|-----------|---------|-------|
| Runtime | Node.js | 24.14.1 | LTS actual, soporte largo plazo |
| Framework | Express | 5.2.1 | Simple, flexible, ecosystem amplio |
| Lenguaje | TypeScript | 6.0.2 | Type safety, mejor DX |
| ORM | Prisma | 6.14.0 | Type-safe, excelente API, migrations |
| Database | PostgreSQL | Supabase | Managed, serverless, confiable |
| Auth | JWT | jsonwebtoken 9.0.3 | Standard, stateless, escalable |
| Password Hash | bcryptjs | 3.0.3 | Seguro, salt rounds configurable |
| Validation | Zod | 4.3.6 | Runtime type validation |
| AI | OpenAI | Latest | GPT-4 para precisión, GPT-3.5 para velocidad |
| Env Vars | dotenv | 17.3.1 | Config segura, no hardcoded secrets |
| CORS | cors | Latest | Restricciones cross-origin |

---

## 🔄 Flujo de Desarrollo

### Setup Inicial
```bash
1. Clone repo
2. npm install
3. Configurar .env
4. npm run prisma:generate
5. Crear tablas en Supabase (SQL)
6. npm run dev
```

### Agregar Endpoint Nuevo
```typescript
1. Crear modelo en prisma/schema.prisma
2. npm run prisma:generate
3. Crear validation.ts (Zod schemas)
4. Crear service.ts (lógica)
5. Crear controller.ts (handlers)
6. Crear routes.ts (rutas + middleware)
7. Registrar en src/app.ts
8. npm run typecheck
9. Test endpoint
```

### Deployment
```bash
1. npm run build  # Compilar TS → JS
2. npm run start  # Ejecutar dist/server.js
3. MongoDB/Supabase debe estar accesible
4. .env debe estar configurado en producción
```

---

## 🚨 Consideraciones Críticas

### Performance
- [ ] Implementar caché para rutinas similares (Redis Fase 3)
- [ ] Pagination en listar endpoints (mediciones)
- [ ] Index en campos frequently queried (userId, email)
- [ ] Connection pooling (Supabase transaction pool)

### Seguridad
- [ ] Rotar `JWT_SECRET` en producción
- [ ] Implementar refresh tokens
- [ ] Rate limiting (express-rate-limit)
- [ ] HTTPS obligatorio en producción
- [ ] Validar OPENAI_API_KEY (no log)
- [ ] CORS whitelist específico

### Escalabilidad
- [ ] Separar read/write queries
- [ ] Async jobs para operaciones pesadas (webhooks)
- [ ] Monitoreo centralizad (Sentry, DataDog)
- [ ] Logging estructurado
- [ ] Métricas (Prometheus)
- [ ] CDN para assets estáticos

### Observabilidad
- [ ] Logging de requests/responses
- [ ] Tracking de errores (OpenAI timeouts)
- [ ] Métricas de latencia
- [ ] Audit trail de cambios

---

## 📚 Archivos Clave

```
backend/
├── src/
│   ├── app.ts                    # Express app setup
│   ├── server.ts                 # Entry point
│   ├── config/
│   │   ├── env.ts               # ENV vars validation (Zod)
│   │   └── prisma.ts            # PrismaClient singleton
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification
│   │   ├── validate.middleware.ts # Zod validation
│   │   ├── error.middleware.ts   # Global error handler
│   │   └── not-found.middleware.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.validation.ts
│   │   ├── users/
│   │   ├── measurements/
│   │   └── ai/
│   ├── types/
│   │   └── express.d.ts          # Extend Request type
│   ├── utils/
│   │   ├── http-error.ts         # Custom error class
│   │   └── jwt.ts                # Token generation/verification
│   └── types/                    # Global types
├── prisma/
│   ├── schema.prisma             # Data models
│   ├── init_supabase.sql         # Fase 1 migration
│   └── add_ai_chat_logs_only.sql # Fase 2 migration
├── .env                          # Environment configuration
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
└── README.md                      # Quick start
```

---

## 🎯 Próximos Steps (Fase 3)

**Semana 1-2: Mobile App**
- React Native setup
- UI components
- API integration

**Semana 3: Webhooks & Async**
- Bull/BullMQ para job queue
- Webhook handlers
- Background tasks

**Semana 4: Observabilidad**
- Sentry error tracking
- Winston logging
- Prometheus metrics

**Semana 5: Testing**
- Unit tests (Jest)
- Integration tests
- E2E tests (Cypress)

---

## 📞 Referencias Rápidas

**JWT Payload**:
```typescript
{ userId: string; role: "admin" | "member"; iat: number; exp: number }
```

**Error Handling**:
```typescript
throw new HttpError(statusCode, "message")
```

**Validate Input**:
```typescript
schema.parse(req.body)  // Zod, throws if invalid
```

**Query Database**:
```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });
```

**Call OpenAI**:
```typescript
const response = await openai.chat.completions.create({ model, messages });
```

---

**Documento actualizado**: Marzo 30, 2026  
**Preparado por**: GymAI Development Team  
**Para**: Future maintainers y continuidad de desarrollo
