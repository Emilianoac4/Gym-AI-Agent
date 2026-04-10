# Tuco - Setup & Configuracion Detallada

**Versión**: 2.0  
**OS**: Linux/macOS/Windows (PowerShell/Bash)  
**Última actualización**: Marzo 30, 2026  

## Convenciones oficiales vigentes

1. Nombre oficial de la aplicacion: Tuco.
2. Portal central web: desplegado en Cloudflare Pages.
3. Netlify no es proveedor operativo activo del portal.
4. Fuente de verdad del portal: `platform-portal/`.

Para detalle normativo y operativo completo:
- `docs/23_CONVENCIONES_OFICIALES_TUCO_CLOUDFLARE.md`

---

## 🚀 Setup Inicial (Desde Cero)

### Requisitos Previos

```bash
# Verificar instalaciones
node --version        # v24+ (recomendado)
npm --version         # 11+
git --version         # Cualquiera
```

Si no tienes Node.js instalado:
- **macOS**: `brew install node`
- **Windows**: Descarga de https://nodejs.org (LTS)
- **Linux**: `sudo apt install nodejs npm`

### Paso 1: Clonar Repositorio

```bash
git clone <repo-url> Agente_Gym
cd Agente_Gym
```

### Paso 2: Instalar Dependencias Backend

```bash
cd backend
npm install
```

**Si estás detrás de proxy (Intel VPN)**:
```bash
npm install \
  --proxy=http://proxy-iil.intel.com:911 \
  --https-proxy=http://proxy-iil.intel.com:911
```

**Esperado**: 195+ packages instalados sin errores

### Paso 3: Configurar Variables de Entorno

Crea archivo `backend/.env`:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Database (Supabase PostgreSQL Connection String)
DATABASE_URL="postgresql://postgres.XXXXX:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# JWT Secret (cambiar en producción)
JWT_SECRET="your-super-secret-jwt-key-change-in-production-min-32-chars"
JWT_EXPIRES_IN="1h"

# OpenAI (Fase 2)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Logging (Fase 3)
LOG_LEVEL="debug"
```

**Cómo obtener DATABASE_URL**:
1. Ir a https://app.supabase.com
2. Selecciona tu proyecto
3. Settings → API → Connection string → PostgreSQL
4. Copia la URL y reemplaza `[PASSWORD]` con tu contraseña

**Cómo obtener OPENAI_API_KEY**:
1. Ir a https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copia y guarda (no se muestra nuevamente)
4. Coloca en `.env`

### Paso 4: Setup Base de Datos

#### Opción A: Crear Tablas (Primer Setup)

1. Abre https://app.supabase.com → [Tu Proyecto] → SQL Editor
2. Copia y ejecuta SQL de `backend/prisma/init_supabase.sql` (Fase 1)
3. Luego de `backend/prisma/add_ai_chat_logs_only.sql` (Fase 2)

```bash
# O generar SQL nuevamente si necesario
cd backend
npm run prisma:generate

# Crear script completo
cmd /c "cd backend && node_modules\.prisma\build\index.js migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script"
```

#### Opción B: Si ya tienes datos (Migración)

```bash
# Backup primera
pg_dump $DATABASE_URL > backup.sql

# Actualizar Prisma client
npm run prisma:generate

# Aplicar cambios (si existen)
npm run prisma:migrate dev
```

### Paso 5: Generar Cliente Prisma

```bash
npm run prisma:generate
```

**Output esperado**:
```
✔ Generated Prisma Client (v6.14.0) to ./node_modules/@prisma/client
```

### Paso 6: Validar TypeScript

```bash
npm run typecheck
```

**Esperado**: 0 errores

---

## 🔧 Configuración Detallada por Componente

### Express.js (src/app.ts)

**Middleware Stack**:
```typescript
app.use(cors());                    // Cross-origin requests
app.use(express.json());            // Parse JSON
app.use(express.urlencoded());      // Parse form data

app.get("/health", healthCheck);    // Health probe

app.use("/auth", authRouter);       // Sin protección (público)
app.use("/users", authenticate, usersRouter);      // Con protección
app.use("/users", authenticate, measurementsRouter);
app.use("/ai", authenticate, aiRouter);

app.use(notFoundHandler);           // 404
app.use(errorHandler);              // Errores global
```

**Configurar CORS para producción**:
```typescript
app.use(cors({
  origin: ["https://app.example.com", "https://mobile.example.com"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
```

### JWT (src/utils/jwt.ts)

**Configuración**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "1h";

// Generar token
export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Verificar token
export function verifyAuthToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}
```

**Para cambiar expiración en producción** (menos de 1h):
```env
JWT_EXPIRES_IN="15m"  # 15 minutos (después usar refresh tokens)
```

### Prisma (src/config/prisma.ts)

**Singleton Pattern (importante)**:
```typescript
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export const db = prisma;
```

**Por qué? Dev server reinicia frecuentemente → Reusar conexión evita agotamiento.**

### OpenAI (src/modules/ai/ai.service.ts)

**Configuración**:
```typescript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Modelos usados
const routineModel = "gpt-4";           // Precisión
const chatModel = "gpt-3.5-turbo";      // Velocidad

// Límites
const maxTokensRoutine = 2000;
const maxTokensChat = 800;
const temperature = 0.7;
```

**Cambiar modelo en producción**:
```typescript
// Para ahorrar costos:
const routineModel = "gpt-3.5-turbo-16k";

// Para más precisión:
const routineModel = "gpt-4-turbo-preview";
```

**Rate Limiting (Fase 3)**:
```typescript
import rateLimit from "express-rate-limit";

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5                     // 5 request por user
});

aiRouter.post("/:userId/routine", aiLimiter, controller);
```

### Password Hashing (bcryptjs)

**Configuración en src/modules/auth/auth.controller.ts**:
```typescript
import bcryptjs from "bcryptjs";

const salt = 12;  // Salt rounds

// Hashear
const passwordHash = await bcryptjs.hash(password, salt);

// Comparar
const isValid = await bcryptjs.compare(password, passwordHash);
```

**Cambiar seguridad (Fase 3)**:
```typescript
// Más seguro pero lento
const salt = 14;  // +25% tiempo

// Menos seguro pero rápido
const salt = 10;  // -25% tiempo
```

### Zod Validation (src/modules/*/validation.ts)

**Ejemplo**:
```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mín 8 caracteres"),
  fullName: z.string().min(2),
  gymName: z.string().optional()
});

// Usar en controller
try {
  const data = registerSchema.parse(req.body);  // Throws si invalid
} catch (error) {
  // Handle error
}
```

**Error response**:
```json
{
  "error": "Zod validation error",
  "issues": [
    {
      "code": "too_small",
      "minimum": 8,
      "type": "string",
      "path": ["password"]
    }
  ]
}
```

---

## 📁 Estructura de Directorios Explicada

```
backend/
├── node_modules/          # Paquetes npm (no commitear)
├── dist/                  # Output compilado (generado)
├── src/
│   ├── config/
│   │   ├── env.ts         # Zod validation de .env
│   │   └── prisma.ts      # PrismaClient singleton
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT verify
│   │   ├── validate.middleware.ts   # Zod parse
│   │   ├── error.middleware.ts      # Global handler
│   │   └── not-found.middleware.ts  # 404
│   │
│   ├── modules/           # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.validation.ts
│   │   ├── users/
│   │   ├── measurements/
│   │   └── ai/            # Fase 2
│   │       ├── ai.service.ts
│   │       ├── ai.controller.ts
│   │       ├── ai.routes.ts
│   │       └── ai.validation.ts
│   │
│   ├── types/
│   │   ├── express.d.ts   # Extend Express Request
│   │   └── index.ts       # Global types
│   │
│   ├── utils/
│   │   ├── http-error.ts  # Custom error class
│   │   └── jwt.ts         # Token sign/verify
│   │
│   ├── app.ts             # Express setup
│   └── server.ts          # Listen + start
│
├── prisma/
│   ├── schema.prisma      # Data models
│   ├── init_supabase.sql  # Fase 1 migration
│   └── add_ai_chat_logs_only.sql  # Fase 2
│
├── .env                   # Environment vars (NO COMMITEAR)
├── .env.example           # Template (commitear esto)
├── tsconfig.json          # TypeScript settings
├── package.json           # Dependencies
├── package-lock.json      # Lock file
└── README.md              # Quick start
```

---

## 🏃 Ejecutar el Backend

### Desarrollo (Con hot reload)

```bash
npm run dev
```

**Output esperado**:
```
Server running on http://localhost:3000
Prisma ORM connected to Supabase
```

**Hot reload (ts-node-dev)**:
- Guardas cambio en archivo
- Servidor reinicia automáticamente
- No pierden datos (en memoria)

### Producción (Compilado)

```bash
# 1. Compilar TypeScript
npm run build

# 2. Ejecutar JavaScript
npm run start
```

**Verificar que compila sin errores**:
```bash
npm run typecheck
```

---

## 🧪 Testing de Configuración

### Endpoint Health Check

```bash
curl http://localhost:3000/health
# Response: {"ok":true}
```

### Prueba de Database

```bash
# Script Prisma: verifica conexión
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.\$queryRaw\`SELECT 1\`;
  console.log('✓ Database OK');
  await prisma.\$disconnect();
})();
"
```

### Prueba de JWT

```bash
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: '123', role: 'admin' }, 'secret', { expiresIn: '1h' });
console.log('Token:', token);
const verified = jwt.verify(token, 'secret');
console.log('Verified:', verified);
"
```

### Prueba de OpenAI

```bash
# Verificar API key configurada
echo \$OPENAI_API_KEY  # No debe estar vacío
```

---

## 🔒 Seguridad - Environment Variables

### .env.example (COMMITEAR)

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-CHANGE-ME
OPENAI_API_KEY=sk-your-key-CHANGE-ME
```

### .env (NO COMMITEAR)

```bash
# En .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

### Verificar que no hay secrets

```bash
# Antes de commitear
git diff HEAD -- .env  # Debe ser vacío

# Buscar secrets en git
git log -p | grep -i "OPENAI_API_KEY"  # Debe ser vacío
```

---

## 📦 NPM Scripts Completos

```json
{
  "scripts": {
    // Desarrollo
    "dev": "ts-node-dev --respawn src/server.ts",
    
    // Production
    "build": "tsc",
    "start": "node dist/src/server.js",
    
    // TypeScript
    "typecheck": "tsc --noEmit",
    
    // Prisma
    "prisma:generate": "prisma generate",
    "prisma:migrate-dev": "prisma migrate dev",
    "prisma:migrate-prod": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    
    // Testing (futuro)
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 🐳 Docker Setup (Opcional Fase 3)

### Dockerfile

```dockerfile
FROM node:24-alpine

WORKDIR /app

# Copy packages
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "run", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
  
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=gymiai
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres-data:
```

### Ejecutar con Docker

```bash
docker-compose up -d    # Start
docker-compose down     # Stop
docker-compose logs -f  # Ver logs
```

---

## 🔄 Deployment a Producción

### Cambios de Configuración para Prod

```env
NODE_ENV=production
PORT=8080                           # No 3000 (puede estár en firewalls)
JWT_EXPIRES_IN=15m                  # Más corto
LOG_LEVEL=error                     # Solo errores

# Database: usar connection pooler
DATABASE_URL="postgresql://...pooler.supabase.com:6543..."

# Secrets: usar secret manager (no .env)
# Heroku / Railway: agregar en dashboard
# AWS: Systems Manager Parameter Store
# GCP: Secret Manager
```

### Pre-deployment Checklist

```bash
# ✅ Verificaciones
npm run typecheck           # Sin errores TS
npm run test               # Tests pasan
npm run build              # Compila OK

# ✅ Security
git log -p | grep -i OPENAI      # No hay keys expuestas
grep -r "password" src/           # No hardcoded

# ✅ Performance
npm audit                  # Sin vulnerabilidades
npm run build && du -sh dist/      # Tamaño razonable

# ✅ Database
# Backup previo
pg_dump $DATABASE_URL > backup.sql

# Ejecutar migrations
npm run prisma:migrate-prod
```

### Deployment Platforms

**Opción 1: Heroku**
```bash
heroku create gymiai-backend
git push heroku main
heroku open
```

**Opción 2: Railway**
- Conectar repo GitHub
- Auto-deploy en push

**Opción 3: AWS EC2**
- SSH a instancia
- `git clone && npm install && npm run build`
- Usar PM2: `pm2 start dist/src/server.js`

**Opción 4: Render / Fly.io**
- Push a repo
- Auto-build y deploy

---

## 📊 Monitoreo Post-Deployment

### Health Checks (Fase 3)

```bash
# Verificar cada 30s
curl -X GET http://localhost:3000/health
```

### Logs

```bash
# Ver logs en tiempo real
tail -f /var/log/gymiai/backend.log

# Errores recientes
grep ERROR /var/log/gymiai/backend.log | tail -20
```

### Métricas (Sentry - Fase 3)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

// Errors automáticamente reportados
```

---

**Documento actualizado**: Marzo 30, 2026  
**Mantenido por**: DevOps Team
