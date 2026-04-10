# Tuco - Decisiones Tecnicas & Troubleshooting

**Versión**: 2.0  
**Fecha**: Marzo 30, 2026  

---

## 🎯 Decisiones Técnicas Mayores

### 1. Node.js + Express (vs Python/Django, .NET/ASP)

**Decisión**: Node.js 24 + Express 5.2

**Razones**:
✅ **JavaScript unificado**: Frontend (React Native) + Backend en mismo lenguaje  
✅ **Ecosistema maduro**: npm, thousands of packages ready  
✅ **Performance**: Event-loop async ideal para I/O (database, OpenAI)  
✅ **Scalabilidad**: Horizontal fácil (stateless)  
✅ **Developer Experience**: TypeScript + ts-node dev hot reload  

**Alternativas consideradas**:
- Python/Django: Excelente para ML/AI, pero overkill para API
- .NET: Excelente performance, pero caro (licenses)
- Go: Más rápido, pero menos JS skills en team
- Java: Enterprise-ready, pero verboso

**Conclusión**: Node.js es ideal para MVP rápido + equipo JavaScript-first

---

### 2. TypeScript (vs JavaScript Puro)

**Decisión**: TypeScript 6.0.2 con `ignoreDeprecations: "6.0"`

**Razones**:
✅ **Type Safety**: Catch bugs en compile-time, no en producción  
✅ **IDE Support**: Autocompletion, refactoring tools  
✅ **Documentación**: Types sirven como documentación ejecutable  
✅ **Maintenance**: Code más legible y refactorable  

**Ventajas en Tuco**:
- Controllers con tipos claros (Request, Response)
- Prisma genera types automáticamente de schema
- JWT payload tipado
- Zod schemas con type inference

**Overhead**:
- Compilación antes de ejecutar
- Setup inicial más complejo
- Learning curve para equipo JavaScript-only

**Mitigado con**:
- ts-node-dev para desarrollo (transpile on-fly)
- Tsconfig bien documentado
- ESLint + Prettier para consistency

---

### 3. Prisma ORM (vs TypeORM, Sequelize, Raw SQL)

**Decisión**: Prisma 6.14.0 (downgradeado de 7 durante desarrollo)

**Razones**:
✅ **Schema as Source of Truth**: prisma.schema es único lugar de verdad  
✅ **Type Safety**: Consultas tipadas automáticamente  
✅ **Migration Tools**: Muy fácil crear/ejecutar migraciones  
✅ **Developer Experience**: Prisma Studio GUI para explorar BD  
✅ **Ecosystem**: Buen soporte para Next.js, Nest.js, otros frameworks  

**Ventajas en Tuco**:
```typescript
// Antes (TypeORM):
const user = await userRepository.findOne(userId);  // Type: any

// Ahora (Prisma):
const user = await prisma.user.findUnique({ where: { id: userId } });  // Type: User
```

**Problemas encontrados**:
- Prisma 7: Cambió datasource config (complicó migraciones)
- **Solución**: Downgrade a Prisma 6 (más estable para este proyecto)

**Futuro (Fase 4+)**:
- Considerar upgrade a Prisma 7 con manejo correcto
- O explorar alternatives como drizzle-orm

---

### 4. PostgreSQL / Supabase (vs MongoDB, Firebase, MySQL)

**Decisión**: PostgreSQL via Supabase (cloud-hosted)

**Razones**:
✅ **ACID Transactions**: Confiabilidad > render perfection  
✅ **Strong Typing**: Schemas enforzados  
✅ **Relationships**: Foreign keys, cascading deletes  
✅ **No Lock-in**: Standard SQL, portable a cualquier postgres  
✅ **Supabase**: Managed, serverless, auth integrada, realtime  

**Ventajas en Tuco**:
- Relaciones claras: Gym → Users → Profiles → Measurements
- Constraints aseguran integridad de datos
- JSON support en campos (futuro para metadata)
- Realtime para chat (Supabase feature)

**Transacciones futura**:
```typescript
// Transaccional atomicity
await prisma.$transaction([
  prisma.user.create({ data: {...} }),
  prisma.gym.update({ where: {...}, data: {...} })
]);
// O sale todo o nada
```

**Connection Pooling**:
- Supabase pooler: 6543 (transaction pooler)
- Evita: "too many connections" errors
- Necesario para escalabilidad (Fase 3+)

---

### 5. JWT Stateless Auth (vs Sessions + Cookies)

**Decisión**: JWT con expiry 1 hora, sin refresh tokens (MVP)

**Razones**:
✅ **Stateless**: Backend no guarda sesiones  
✅ **Escalable**: No necesita session store  
✅ **Mobile-Friendly**: Perfecto para React Native  
✅ **Microservices-Ready**: Fácil validar en múltiples servers  

**Trade-offs**:
- Token no se puede revocar antes de expiración (worse: logout)
- No ideal para operaciones críticas (transacciones dinero)
- Requiere refresh tokens para experiencia UX mejor

**Implementación **actual**:
```typescript
// Generar
jwt.sign({ userId, role }, SECRET, { expiresIn: "1h" });

// Validar
jwt.verify(token, SECRET);
```

**Mejoras Fase 3**:
```typescript
// Agregar refresh tokens
{
  accessToken: "short-lived (15m)",
  refreshToken: "long-lived (7d)",
  expiresIn: 900
}

// En logout: blacklist tokens (Redis)
```

---

### 6. Zod para Validación Runtime (vs Yup, Joi, Manual)

**Decisión**: Zod 4.3.6

**Razones**:
✅ **TypeScript Native**: Infer types del schema  
✅ **Parsing**: No solo validación, también transforma datos  
✅ **Errores Claros**: Mensajes de error en array estructurado  
✅ **Performance**: Más rápido que alternatives  

**Ejemplo en Tuco**:
```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string()
});

// Zod infiere type automaticamente
type RegisterInput = z.infer<typeof registerSchema>;

// Parsing
const data = registerSchema.parse(req.body);
// Si invalid, Zod lanza error con detalles
```

**Ventaja**: 1 schema = validación + tipo TypeScript

---

### 7. bcryptjs para Password Hashing (vs Argon2, PBKDF2)

**Decisión**: bcryptjs 3.0.3 con salt rounds = 12

**Razones**:
✅ **Seguridad**: Resistente a GPU attacks (adaptive algorithm)  
✅ **Standard**: Ampliamente usado y auditado  
✅ **Puro JS**: Funciona en todas partes (no libcrypto required)  
✅ **Salt Rounds**: 12 = buen balance seguridad/performance  

**Comparativa**:
| Hash | Velocidad | Seguridad | Portable |
|------|-----------|-----------|----------|
| bcryptjs | Normal | Alta | Puro JS |
| Argon2 | Lenta | Muy Alta | Native |
| PBKDF2 | Rápida | Media | Native |

**Configuración**:
```typescript
const saltRounds = 12;  // ~200ms por hash

// Cambiar si:
// - Lenta (production): saltRounds = 10
// - Menos segura de lo deseado: saltRounds = 14 (+tiempo)
```

---

### 8. OpenAI GPT-4 para rutinas (vs Claude, Cohere, local LLMs)

**Decisión**: GPT-4 para rutinas, GPT-3.5-turbo para chat/tips

**Razones**:
✅ **Mejor API**: Mejor JSON schema support  
✅ **Precision**: Rutinas better structured than alternatives  
✅ **Ecosystem**: Más herramientas/librerías  
✅ **Maturity**: Most tested for production use  

**Cost Analysis**:
- GPT-4: $0.03 input / $0.06 output per 1K tokens (~0.10€ per routine)
- GPT-3.5: $0.0005 input / $0.0015 output per 1K tokens (~0.001€ per chat)

**Estrategia Costos**:
✅ **Producción**: Usar GPT-3.5 para todo (ahorro 98%)  
⚠️ **Trade-off**: Menos precisión en JSONs  

**Alternativas (Fase 3+)**:
- Self-hosted Llama 2 (open source, pero requiere hardware)
- Azure OpenAI (cheaper wholesale pricing)
- Anthropic Claude (mejor para certain tasks)

---

### 9. Module-per-Feature Architecture

**Decisión**: Organizar por feature (`/auth`, `/users`, `/ai`) vs por layer

**Structure Actual**:
```
modules/
├── auth/
│   ├── controller.ts
│   ├── routes.ts
│   └── validation.ts
├── users/
│   ├── controller.ts
│   ├── routes.ts
│   └── validation.ts
└── ai/
    ├── service.ts
    ├── controller.ts
    ├── routes.ts
    └── validation.ts
```

**Alternativa NO usada**:
```
layers/
├── controllers/
│   ├── auth.ts
│   ├── users.ts
│   └── ai.ts
├── services/
├── routes/
└── validators/
```

**Por qué no layer-based**:
❌ Cambiar feature requiere navegar 3-4 carpetas  
❌ Difícil entender scope de feature  
❌ Escalabilidad: 100 endpoints = carpetas gigantes  

**Ventajas Module-per-Feature**:
✅ Self-contained: Todo para feature en una carpeta  
✅ Escalable: Agregar feature = nueva carpeta  
✅ Team-friendly: Múltiples equipos sin conflictos  
✅ Testing: Test file vive cerca del código  

---

## 🐛 Troubleshooting Guía Completa

### Error: "Cannot find module '@prisma/client'"

**Síntomas**:
```
Error: Cannot find module '@prisma/client'
```

**Causas**:
1. npm install incompleto
2. Prisma client no generado
3. tsconfig paths configurado incorrectamente

**Soluciones**:
```bash
# 1. Reinstalar
rm -rf node_modules package-lock.json
npm install

# 2. Regenerar Prisma
npm run prisma:generate

# 3. Si sigue fallando, revisar .env
echo $DATABASE_URL  # Debe no estar vacío
```

---

### Error: "P1001: Can't reach database server"

**Síntomas**:
```
Error: P1001: Can't reach database server at `aws-0-us-west-2.pooler.supabase.com:6543`
```

**Causas**:
1. ❌ DATABASE_URL incorrecta
2. ❌ Supabase proyecto no existe
3. ❌ Firewall/VPN bloqueando puerto 6543
4. ❌ Intel VPN interfiriendo

**Soluciones**:
```bash
# 1. Verificar .env
cat .env | grep DATABASE_URL

# 2. Test conectividad
nslookup aws-0-us-west-2.pooler.supabase.com  # Debe resolver
telnet aws-0-us-west-2.pooler.supabase.com 6543  # Debe conectar

# 3. Si detrás de proxy
$env:HTTP_PROXY="http://proxy-iil.intel.com:911"

# 4. Desconectar VPN (Supabase pooler no está en VPN whitelist)

# 5. Test directo desde psql
psql "postgresql://..."  # Debe conectar
```

**Verification Script**:
```bash
# Windows PowerShell
Test-NetConnection -ComputerName aws-0-us-west-2.pooler.supabase.com -Port 6543

# Linux/Mac
nc -zv aws-0-us-west-2.pooler.supabase.com 6543
```

---

### Error: "OPENAI_API_KEY is not set"

**Síntomas**:
```
Error: OPENAI_API_KEY is not set
```

**Causas**:
1. ❌ .env no tiene OPENAI_API_KEY
2. ❌ .env no está siendo leído (dotenv issue)
3. ❌ npm run dev no recarga .env después de editar

**Soluciones**:
```bash
# 1. Agregar a .env
echo 'OPENAI_API_KEY="sk-your-key-here"' >> .env

# 2. Verificar que se lee
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY);"

# 3. Si npm run dev estaba activo, reiniciar
# Ctrl+C
npm run dev  # Nuevo proceso lee .env

# 4. Verificar que es API key válida
# https://platform.openai.com/api-keys
# Debe comenzar con "sk-"
```

---

### Error: "TypeScript compilation error TS2307"

**Síntomas**:
```
error TS2307: Cannot find module '../../utils/errors'
```

**Causas**:
1. ❌ Archivo no existe
2. ❌ Path incorrecto (case-sensitive en Linux)
3. ❌ Extensión faltante (.ts)

**Soluciones**:
```bash
# 1. Verificar que archivo existe
ls -la src/utils/errors.ts  # Si no existe, crear

# 2. Revisar path exacto
# Caso A: file exists pero import path wrong
# Change: import { HttpError } from "../../utils/errors"
# To:     import { HttpError } from "../../utils/http-error"

# 3. Ejecutar typecheck
npm run typecheck

# 4. Si sigue fallando, clean rebuild
rm -rf node_modules/.cache
npm run prisma:generate
```

---

### Error: "ValidationError: Invalid input to create"

**Síntomas**:
```
ValidationError: Invalid `prisma.user.create()` invocation
  passwordHash: null
```

**Causas**:
1. ❌ Campo requerido es null
2. ❌ Tipo de datos incorrecto
3. ❌ Schema mismatch

**Soluciones**:
```typescript
// ❌ WRONG
const user = await prisma.user.create({
  data: {
    email: "test@test.com",
    passwordHash: null,  // No puede ser null
    fullName: "Test"
  }
});

// ✅ CORRECT
const user = await prisma.user.create({
  data: {
    email: "test@test.com",
    passwordHash: hashPassword("password"),
    fullName: "Test",
    gymId: "some-uuid"  // Required!
  }
});
```

**Mensajes útiles**:
- Si says "invalid input", revisar **schema.prisma** para campos @required
- Si dice "unique constraint", email ya existe

---

### Error: "Port 3000 already in use"

**Síntomas**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Causas**:
1. ❌ Servidor ya corriendo en otra terminal
2. ❌ Proceso anterior no murió

**Soluciones**:
```bash
# Windows PowerShell
Get-Process -Name node | Stop-Process -Force
npm run dev

# Linux/Mac
lsof -ti:3000 | xargs kill -9
npm run dev

# O cambiar puerto
PORT=3001 npm run dev
```

---

### Error: "403 Forbidden" on private endpoints

**Síntomas**:
```json
{
  "statusCode": 403,
  "message": "Forbidden"
}
```

**Causas**:
1. ❌ Token JWT missing
2. ❌ Token expired
3. ❌ Member accediendo datos de otro usuario
4. ❌ Invalid JWT_SECRET

**Soluciones**:
```typescript
// 1. Verificar header Authorization
const token = req.headers.authorization?.slice(7);  // Remove "Bearer "
if (!token) throw new HttpError(401, "Missing token");

// 2. Si token expirado
const now = Math.floor(Date.now() / 1000);
const decoded = jwt.decode(token);
if (decoded.exp < now) {
  // Token expired - must login again
  throw new HttpError(401, "Token expired");
}

// 3. Si member accediendo otro user
const auth = jwt.verify(token, JWT_SECRET);
const userId = req.params.userId;
if (auth.role !== "admin" && auth.userId !== userId) {
  throw new HttpError(403, "Forbidden");
}

// 4. Si JWT_SECRET cambió
// Members viejos no pueden acceder
// Solución: logout + login
```

---

### Error: "401 Unauthorized - Invalid token"

**Síntomas**:
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token"
}
```

**Causas**:
1. ❌ Token JWT inválido/corrupto
2. ❌ Token signed con SECRET diferente
3. ❌ JWT_SECRET cambió

**Soluciones**:
```bash
# 1. Decodificar token para inspeccionar
node -e "
const jwt = require('jsonwebtoken');
const token = 'eyJ...'; // Copiar token
const decoded = jwt.decode(token, { complete: true });
console.log(decoded);
"

# 2. Si ilegible, verificar que comenzar con "eyJ"
# Si no, no es JWT válido

# 3. Si JWT_SECRET cambió
# Todos los tokens viejos son inválidos
# Usuarios deben hacer login nuevamente
```

---

### Error: "OpenAI Rate Limit Exceeded"

**Síntomas**:
```
Error: 429 Too Many Requests
```

**Causas**:
1. ❌ API rate limit alcanzado
2. ❌ Muchas requests simultáneas
3. ❌ No hay delay entre calls

**Soluciones**:
```typescript
// Implementar retry con backoff exponencial
async function callOpenAIWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;  // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

**Rate Limits OpenAI**:
- Free: 3 requests/min
- Paid: 3,500 requests/min (GPT-4)
- Contact support para aumentar

---

### Error: "npm install behind VPN fails"

**Síntomas**:
```
ERR! Error: ENOTFOUND registry.npmjs.org
```

**Causas**:
1. ❌ Proxy corporativo bloqueando npm registry
2. ❌ Certificado SSL inválido

**Soluciones**:
```bash
# Configure npm proxy
npm config set proxy http://proxy-iil.intel.com:911
npm config set https-proxy http://proxy-iil.intel.com:911

# O per-command
npm install --proxy=http://proxy-iil.intel.com:911

# Deshabilitar SSL verification (NOT RECOMMENDED)
npm config set strict-ssl false

# Usar registry alternativo
npm config set registry https://registry.npmjs.org

# Verify config
npm config list
```

---

### Error: "Prisma schema validation error"

**Síntomas**:
```
schema.prisma validation error: Error parsing schema.prisma:
```

**Causas**:
1. ❌ Syntax error en prisma/schema.prisma
2. ❌ Relación no definida
3. ❌ Type incorrecto

**Soluciones**:
```prisma
// ❌ WRONG - Missing model
model User {
  profileId String
  profile UserProfile  // ← UserProfile no definido
}

// ✅ CORRECT
model User {
  profile UserProfile @relation(fields: [profileId], references: [id])
  profileId String
}

model UserProfile {
  id String @id
}
```

**Validar**:
```bash
npm run prisma:generate
# Si hay error, mostrará línea exacta
```

---

### Error: "Request timeout calling OpenAI"

**Síntomas**:
```
TimeoutError: Request timed out after 30000ms
```

**Causas**:
1. ❌ OpenAI API lento
2. ❌ Network instable
3. ❌ Prompt demasiado grande (muchos tokens)

**Soluciones**:
```typescript
// Aumentar timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000  // 60 segundos
});

// O implementar stream (no wait)
for await (const chunk of stream) {
  // Procesar mientras llega
}

// Optimizar prompt (menos tokens)
const shortPrompt = prompt.substring(0, 1000);  // Truncar
```

---

### Error: Database deadlock (Concurrency)

**Síntomas**:
```
ERROR: deadlock detected
```

**Causas**:
1. ❌ Múltiples queries compitiendo por mismo recurso
2. ❌ No usar transacciones

**Soluciones**:
```typescript
// ❌ WRONG - Sin transacción
const user = await prisma.user.update(...);
const profile = await prisma.userProfile.update(...);

// ✅ CORRECT - Transacción atómica
await prisma.$transaction([
  prisma.user.update(...),
  prisma.userProfile.update(...)
]);
```

---

## 🚀 Performance Issues

### Slow Queries

**Diagnosticar**:
```bash
# Enable Prisma query logging
export DEBUG="prisma:*"
npm run dev
```

**Soluciones**:
1. Agregar índices (ver Database docs)
2. Usar `include` efficiently
3. Pagination en listar endpoints

```typescript
// ❌ SLOW - N+1 problem
const users = await prisma.user.findMany();
for (const user of users) {
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
}

// ✅ FAST - Eager loading
const users = await prisma.user.findMany({
  include: { profile: true }
});
```

### High Memory Usage

**Diagnosticar**:
```bash
node --max-old-space-size=4096 dist/src/server.js
```

**Soluciones**:
1. Implementar connection pooling (Supabase pooler)
2. Pagination en queries grandes
3. Streaming responses

---

## 📋 Checklist para Debugging

Cuando algo falla:
```
☐ Revisar logs (.env LOG_LEVEL=debug)
☐ npm run typecheck (errores TS)
☐ Verificar .env (DATABASE_URL, OPENAI_API_KEY)
☐ Revisar endpoint en cuerpo (POST vs GET)
☐ Checar Headers Authorization JWT
☐ Probar endpoint con curl/Postman
☐ Ver request/response bodies exactos
☐ Verificar database (Supabase dashboard)
☐ Revisar npm audit para vulnerabilidades
☐ Git diff mostrar cambios recientes
```

---

**Documento actualizado**: Marzo 30, 2026  
**Mantenido por**: Engineering Team
