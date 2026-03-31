# GymAI - Roadmap Detallado & Continuidad

**Versión**: 2.0  
**Status**: Fase 1 ✅ + Fase 2 ✅ / Fase 3-5 📋  
**Última actualización**: Marzo 30, 2026  

---

## 📅 Roadmap Completo

### ✅ Fase 1: Fundamentos (Completa)
**Período**: Marzo 26-30, 2026 (5 días)  
**Status**: DEPLOYABLE

**Alcance**:
- [x] TypeScript + Express backend
- [x] Prisma ORM + PostgreSQL (Supabase)
- [x] Autenticación JWT
- [x] User & Profile management
- [x] Measurement tracking
- [x] Role-based access control

**Entregables**:
- Express API en http://localhost:3000
- Tablas: gyms, users, user_profiles, measurements
- Endpoints funcionales para CRUD básico
- Tests manuales exitosos

**Comandos Para Retomar**:
```bash
cd backend
npm install
npm run dev
# Server activo en :3000
```

---

### ✅ Fase 2: Integración IA (Completa)
**Período**: Marzo 30-31, 2026 (1-2 días)  
**Status**: TESTABLE

**Alcance**:
- [x] OpenAI SDK integrado (gpt-4 + gpt-3.5-turbo)
- [x] Servicios IA:
  - generateRoutine() - Rutinas personalizadas
  - generateNutritionPlan() - Planes nutricionales
  - chat() - Chat libre
  - generateDailyTip() - Tips motivacionales
- [x] Tabla ai_chat_logs para audit trail
- [x] Logging automático de interacciones
- [x] TypeScript compilation 0 errores

**Entregables**:
- 5 nuevos endpoints /ai/*
- Integración OpenAI funcional
- Documentación API completa (docs/04_FASE2_API_IA.md)
- Script de test (backend/test-complete-flow.ps1)

**Para Testear**:
```bash
# 1. Configurar OPENAI_API_KEY en .env
OPENAI_API_KEY="sk-..."

# 2. Crear tabla en Supabase SQL Editor
# Ver docs/04_FASE2_API_IA.md

# 3. Ejecutar test
./backend/test-complete-flow.ps1
```

---

### 🔄 Fase 3: Mobile App (Próxima)
**Período Estimado**: 2 semanas (Abril 1-15)  
**Status**: DISEÑO EN PROCESO

**Alcance**:

#### Frontend Architecture
```
react-native-app/
├── src/
│   ├── screens/
│   │   ├── AuthStack/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── MainStack/
│   │   │   ├── HomeScreen.tsx (Dashboard)
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── RoutineScreen.tsx (IA-generated)
│   │   │   ├── ChatScreen.tsx (IA chat)
│   │   │   ├── MeasurementsScreen.tsx
│   │   │   └── HistoryScreen.tsx
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── RoutineCard.tsx
│   │   └── ...
│   ├── services/
│   │   ├── api.ts (Axios/Fetch to backend)
│   │   ├── auth.ts (JWT storage)
│   │   └── asyncStorage.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   └── App.tsx
```

#### Tech Stack Mobile
- **Framework**: React Native 0.73+
- **Navigation**: React Navigation 6+
- **State**: Zustand o Context API
- **HTTP Client**: Axios 1.6+
- **Auth Storage**: react-native-secure-store
- **UI Components**: NativeBase o React Native Paper
- **Push Notifications**: Firebase Cloud Messaging

#### Fases Desarrollo
1. **Semana 1**: Setup + Auth Screens
2. **Semana 2**: Home + Profile + Routine screens
3. **Semana 3**: Chat + Measurements + Integration
4. **Semana 4**: Testing + Deployment

**Cómo Iniciar**:
```bash
# Setup React Native (supone Xcode/Android Studio instalado)
npx create-expo-app mobile

# O con Expo:
npx create-expo-app --template

cd mobile
npm install axios zustand @react-navigation/native

# Conectar a backend
# Ver services/api.ts
```

**Consideraciones**:
- SSL: Backend HTTPS para producción
- Auth: Guardar JWT en secure storage (no localStorage)
- Offline: Implementar queue para offline requests
- Updates: Usar EAS Updates para hot reload

---

### 🔄 Fase 4: Webhooks & Async Processing (Semana 3-4)
**Período Estimado**: 1 semana (Abril 15-22)  
**Status**: DISEÑO

**Alcance**:

#### Job Queue (Bull + Redis)
```typescript
// backend/src/jobs/
├── generateRoutineJob.ts      // Rutinas en background
├── sendNotificationJob.ts      // Notificaciones push
├── generateReportJob.ts        // Reportes semanales
└── queue.ts                    // Setup Bull queue
```

#### Features:
- Generar rutinas sin bloquear request (queue)
- Enviar notificaciones push a usuarios
- Generar reportes semanales de progreso
- Retry automático en fallidas
- Monitoring de job status

#### Implementación:
```bash
# Instalar
npm install bull bull-board redis

# Setup Redis (local o cloud)
docker run -p 6379:6379 redis

# Usar en service
import Queue from "bull";

const routineQueue = new Queue("routines", {
  redis: { host: "127.0.0.1", port: 6379 }
});

// Agregar job
await routineQueue.add({ userId }, { delay: 5000 });

// Procesar
routineQueue.process(async (job) => {
  const routine = await generateRoutine(job.data.userId);
  return routine;
});
```

**Ventajas**:
- Requests retornan inmediatamente
- Processing en background sin bloquear
- Retry automático en fallos
- Escalable (múltiples workers)

---

### 🔄 Fase 5: Observabilidad & Analytics (Semana 4)
**Período Estimado**: 1 semana (Abril 22-29)  
**Status**: DISEÑO

#### Logging (Winston)
```typescript
// backend/src/utils/logger.ts
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});
```

#### Error Tracking (Sentry)
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV
});

// Auto-capture unhandled errors
app.use(Sentry.Handlers.errorHandler());
```

#### Analytics (PostHog / Amplitude)
```typescript
// Track user actions
posthog.capture({
  distinctId: userId,
  event: "routine_generated",
  properties: {
    duration: "8 weeks",
    model: "gpt-4"
  }
});
```

#### Metrics (Prometheus)
```typescript
import prom from "prom-client";

const routineCounter = new prom.Counter({
  name: "routines_generated_total",
  help: "Total number of routines generated"
});

app.get("/metrics", (req, res) => {
  res.set("Content-Type", prom.register.contentType);
  res.end(prom.register.metrics());
});
```

---

### 🔄 Fase 6: Testing & CI/CD (Mes 2)
**Período Estimado**: 1-2 semanas  
**Status**: DISEÑO

#### Unit Tests (Jest)
```typescript
// backend/src/modules/auth/__tests__/auth.test.ts
import { describe, it, expect } from "@jest/globals";

describe("AuthController", () => {
  it("should register user successfully", async () => {
    const payload = { email: "test@test.com", password: "password" };
    const result = await authService.register(payload);
    expect(result.user.email).toBe(payload.email);
  });
});
```

#### Integration Tests (Supertest)
```typescript
import request from "supertest";
import { app } from "../app";

describe("GET /health", () => {
  it("should return 200", async () => {
    const response = await request(app).get("/health");
    expect(response.statusCode).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
```

#### E2E Tests (Cypress)
```javascript
// e2e/auth.cy.js
describe("Auth Flow", () => {
  it("should login successfully", () => {
    cy.visit("http://localhost:3000");
    cy.get("[data-testid=email]").type("user@test.com");
    cy.get("[data-testid=password]").type("password");
    cy.get("[data-testid=submit]").click();
    cy.url().should("include", "/dashboard");
  });
});
```

#### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'
      - run: npm install
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

---

### 🔄 Fase 7: Performance & Scaling (Mes 3)
**Período Estimado**: 1-2 semanas  
**Status**: DISEÑO

#### Caching (Redis + Prisma)
```typescript
// backend/src/utils/cache.ts
import redis from "redis";

const cache = redis.createClient();

export async function getCachedRoutine(userId: string) {
  const cached = await cache.get(`routine:${userId}`);
  if (cached) return JSON.parse(cached);
  
  const routine = await generateRoutine(userId);
  await cache.setEx(`routine:${userId}`, 86400, JSON.stringify(routine));
  return routine;
}
```

#### Database Optimization
- [ ] Query optimization con EXPLAIN ANALYZE
- [ ] Índices en campos frequently queried
- [ ] Partitioning de tablas grandes
- [ ] Read replicas para Supabase

#### API Gateway (Kong)
- [ ] Rate limiting por user
- [ ] Authentication centralized
- [ ] Request/Response transformation
- [ ] API versioning

#### Load Balancing
```bash
# Nginx reverse proxy
upstream backend {
  server backend1:3000;
  server backend2:3000;
  server backend3:3000;
}

server {
  listen 80;
  location / {
    proxy_pass http://backend;
  }
}
```

---

### 🔄 Fase 8: Advanced Features (Mes 4+)
**Status**: BACKLOG

#### Personalized Progress Tracking
```typescript
// Compare measurements over time
const history = await prisma.measurement.findMany({
  where: { userId },
  orderBy: { date: "asc" }
});

const progress = {
  weightChange: history[history.length - 1].weight - history[0].weight,
  fatLoss: history[history.length - 1].bodyFat - history[0].bodyFat,
  muscleGain: history[history.length - 1].muscle - history[0].muscle
};
```

#### Alert System
```typescript
// notify if weight gain > 2kg in 1 week
if (weightGain > 2) {
  await notificationService.send(userId, {
    title: "Weight Alert",
    body: "Consider reviewing your nutrition plan"
  });
}
```

#### Recommendations Engine
```typescript
// AI generates smart suggestions
const recommendation = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{
    role: "user",
    content: `Based on this progress... recommend next steps`
  }]
});
```

#### Social Features
- [ ] Follow other users
- [ ] Share routines
- [ ] Community feed
- [ ] Leaderboards

#### Integrations
- [ ] Fitbit API sync
- [ ] Apple Health
- [ ] Google Fit
- [ ] Calendar sync

---

## 🔗 Continuidad Técnica

### Cómo Retomar Desarrollo

#### Acceso a Códigos
```bash
# 1. Clone repo
git clone <url>
cd Agente_Gym

# 2. Backend
cd backend
npm install
npm run dev

# 3. Database
# Supabase dashboard: https://app.supabase.com

# 4. API Testing
curl http://localhost:3000/health
```

#### Estructura Commits
```bash
# Usar convencional commits
git commit -m "feat: add routine generation endpoint"
git commit -m "fix: database connection timeout"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for auth"
```

#### Branch Strategy
```bash
# Main branch es production
git checkout main

# Develop branch para unstable
git checkout develop

# Feature branches
git checkout -b feature/chat-history
git checkout -b bugfix/jwt-validation

# Merge flow
# feature → develop → main
```

---

### Ambiente de Desarrollo Recomendado

#### Local
```
Requerimientos:
- Node.js 24+ (https://nodejs.org)
- PostgreSQL 15+ (si DB local)
  o Supabase account (https://supabase.com)
- OpenAI API key (https://platform.openai.com)
- IDE: VS Code + Extensions:
  * Prisma
  * Thunder Client (API testing)
  * Error Lens
```

#### Configurar IDE
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "debug.console.fontSize": 14
}
```

---

### Documentación Nueva Dev

Cuando nuevas personas se unan:
1. Lee [README.md](backend/README.md)
2. Lee [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md)
3. Setup local siguiendo [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md)
4. Prueba endpoints con [test-complete-flow.ps1](backend/test-complete-flow.ps1)
5. Consulta [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md) para problemas

---

### Key Contacts & Resources

**Documentation**:
- 📖 [Full API Docs](docs/04_FASE2_API_IA.md)
- 🏗️ [Architecture](docs/05_ARQUITECTURA_DETALLADA.md)
- 🗄️ [Database Schema](docs/06_DATABASE_DETALLADA.md)
- 🔧 [Setup Guide](docs/07_SETUP_CONFIGURACION.md)
- 🐛 [Troubleshooting](docs/08_DECISIONES_TROUBLESHOOTING.md)

**External Services**:
- 🌐 **Supabase**: https://app.supabase.com
- 🤖 **OpenAI**: https://platform.openai.com
- 💾 **GitHub**: [Push repo URL aquí]

**Development Tools**:
- **Backend**: Express, TypeScript, Prisma
- **Database**: PostgreSQL (Supabase)
- **API Testing**: Postman, curl, Thunder Client
- **Version Control**: Git + GitHub

---

### Criterios de Completitud por Fase

#### Fase 3 (Mobile)
✅ Checklist:
- [ ] Todas las historias de usuario implementadas
- [ ] 80%+ cobertura de tests
- [ ] Performance < 2s load time
- [ ] Works en iOS (A14+) y Android (8+)
- [ ] Publicado en App Store beta

#### Fase 4 (Webhooks)
✅ Checklist:
- [ ] Job queue operational
- [ ] Notifications en-time
- [ ] Retry logic functional
- [ ] No data loss on crashes

#### Fase 5 (Observability)
✅ Checklist:
- [ ] Logging en todos endpoints
- [ ] Error tracking centralizado
- [ ] Metrics en Grafana
- [ ] Alertas configuradas

---

## 🎯 Sprints Sugeridos

### Sprint 1 (Fase 3 Semana 1)
**Goal**: Mobile auth y UI base  
**Tasks**:
- [ ] React Native project setup
- [ ] Navigation structure
- [ ] Login/Register screens
- [ ] Token storage (secure)
- [ ] Basic styling (theming)

**Estimación**: 40 horas  
**Team**: 2-3 devs mobile  

### Sprint 2 (Fase 3 Semana 2-3)
**Goal**: Feature screens y API integration  
**Tasks**:
- [ ] Dashboard screen
- [ ] Profile screen
- [ ] Routine generation UI
- [ ] Chat UI
- [ ] API error handling

**Estimación**: 60 horas  

### Sprint 3 (Fase 4)
**Goal**: Background processing  
**Tasks**:
- [ ] Setup Redis
- [ ] Bull queue integration
- [ ] Notification service
- [ ] Job monitoring

**Estimación**: 40 horas  

---

**Documento actualizado**: Marzo 30, 2026  
**Mantenido por**: Product & Engineering Team  
**Próxima revisión**: Marzo 31, 2026
