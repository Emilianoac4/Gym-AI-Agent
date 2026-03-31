# GymAI - Índice de Documentación Completa

**Tabla de Contenidos Maestra**  
**Última actualización**: Marzo 30, 2026  
**Version**: 2.0 (Fase 1 + Fase 2 Completas)

---

## 🎯 Start Here (Comienza Aquí)

### Para nuevos desarrolladores:
1. Lee **este índice** (estás aquí)
2. Ve a [README.md](APPS_EAC/Agente_Gym/backend/README.md) para Quick Start (5 min)
3. Sigue [Setup & Configuración](docs/07_SETUP_CONFIGURACION.md) para ambiente local (15 min)
4. Prueba endpoints con [Script de Test](backend/test-complete-flow.ps1) (10 min)

### Para continuar con Fase 3+:
1. Lee [Roadmap Detallado](docs/09_ROADMAP_CONTINUIDAD.md)
2. Estudia [Arquitectura General](docs/05_ARQUITECTURA_DETALLADA.md)
3. Consulta [Decisiones Técnicas](docs/08_DECISIONES_TROUBLESHOOTING.md)

### Para troubleshooting:
1. Busca error en [Troubleshooting Guide](docs/08_DECISIONES_TROUBLESHOOTING.md)
2. Si no está, consulta [Setup Issues](docs/07_SETUP_CONFIGURACION.md)
3. Verifica [API Errors](docs/04_FASE2_API_IA.md#posibles-errores)

---

## 📚 Guía Por Documento

### 🚀 [01_PLAN_DE_DESARROLLO.md](docs/01_PLAN_DE_DESARROLLO.md)
**Contenido**: Visión general del proyecto (ORIGINAL)  
**Para quién**: Product owners, stakeholders  
**Tiempo**: 10 min de lectura  
**Secciones**:
- Visión GymAI
- Fases (1-7)
- Timeline estimado
- Objetivos por semana

**Cuándo consultar**:
- Necesitas entender qué es GymAI
- Requieres timeline del proyecto
- Stakeholder te pregunta sobre roadmap

---

### 🏗️ [02_ARQUITECTURA.md](docs/02_ARQUITECTURA.md)
**Contenido**: Diagrama alto nivel (ORIGINAL)  
**Para quién**: Tech leads, architects  
**Tiempo**: 5-10 min  
**Secciones**:
- Stack tecnológico
- Componentes principales
- Diagrama entidades
- Flujos de datos

**Cuándo consultar**:
- Necesitas ver panorama general
- Decides qué tecnología usar
- Explicas a stakeholder la arquitectura

---

### 📋 [03_ROADMAP_TECNICO.md](docs/03_ROADMAP_TECNICO.md)
**Contenido**: Detalles técnicos por semana (ORIGINAL)  
**Para quién**: Developers, project managers  
**Tiempo**: 15 min  
**Secciones**:
- Semana 1-7
- Tasks específicas
- Deliverables
- Dependencies

**Cuándo consultar**:
- Nesecitas saber qué hacer esta semana
- Vas a empezar una nueva fase
- Estimando esfuerzo

---

### 🤖 [04_FASE2_API_IA.md](docs/04_FASE2_API_IA.md)  📍 **NUEVO**
**Contenido**: API completa de endpoints IA (FASE 2)  
**Para quién**: Mobile developers, API consumers  
**Tiempo**: 20 min  
**Secciones**:
- Requerimientos OpenAI
- 5 endpoints `/ai/*`
- Ejemplos PowerShell/cURL completos
- Error handling
- Rate limits

**Cuándo consultar**:
- Necesitas integrar IA en mobile
- Testeau endpoint IA
- Documentas API para cliente
- Diseñas error handling

**Endpoints documentados**:
- `POST /ai/:userId/routine` - Generar rutina
- `POST /ai/:userId/nutrition` - Generar nutrición
- `POST /ai/:userId/chat` - Chat libre
- `GET /ai/:userId/tip` - Tip diario
- `GET /ai/:userId/history` - Historial

---

### 📐 [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md)  📍 **NUEVO**
**Contenido**: Arquitectura exhaustiva con explicaciones  
**Para quién**: Senior developers, architects  
**Tiempo**: 45 min  
**Secciones**:
- Capas de arquitectura (5)
- Módulos principales (auth, users, measurements, ai)
- Flujos de negocio
- Protección y autorización
- Data flow detallado
- Tech stack justificado

**Cuándo consultar**:
- Necesitas entender el diseño completo
- Vas a agregar un módulo nuevo
- Onboarding de developer senior
- Revisión de arquitectura

**Key diagrams**:
- Layer architecture
- Module dependencies
- Auth flow
- RBAC rules
- Data flow example (routine generation)

---

### 🗄️ [06_DATABASE_DETALLADA.md](docs/06_DATABASE_DETALLADA.md)  📍 **NUEVO**
**Contenido**: Schema database exhaustivo  
**Para quién**: Database admins, backend developers  
**Tiempo**: 60 min  
**Secciones**:
- Diagrama ER completo
- Tabla por tabla (5 tablas):
  - gyms
  - users
  - user_profiles
  - measurements
  - ai_chat_logs
- Índices y performance
- Relaciones y constraints
- Cascading deletes
- Queries de ejemplo

**Cuándo consultar**:
- Necesitas entender schema
- Vas a agregar tabla nueva
- Debugging query problems
- Migraciones a producción
- Backups/recovery

**Para cada tabla**:
- Definición Prisma
- SQL PostgreSQL
- Tabla de campos
- Relaciones
- Constraints
- Ejemplos de datos
- Queries típicas

---

### 🔧 [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md)  📍 **NUEVO**
**Contenido**: Setup completo paso a paso  
**Para quién**: New developers, DevOps  
**Tiempo**: 30 min setup + 10 min validation  
**Secciones**:
- Setup inicial desde cero
- Configuración detallada por componente
- .env variables
- NPM scripts
- Docker setup
- Deployment checklist
- Monitoreo

**Cuándo consultar**:
- Primera vez setup local
- Nuevo dev se une al equipo
- Deployment a producción
- Docker containerization
- CI/CD setup

**Step-by-step**:
1. Requisitos previos
2. Clonar repo
3. Instalar dependencias
4. Variables de entorno
5. Database setup
6. Prisma client
7. TypeScript validation
8. Ejecutar servidor
9. Testing

**Para cada herramienta**:
- Qué es
- Configuración en GymAI
- Cómo cambiar settings
- Problemas comunes

---

### 🐛 [08_DECISIONES_TECH_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md)  📍 **NUEVO**
**Contenido**: Por qué cada decisión + Troubleshooting  
**Para quién**: Developers, architects, troubleshooters  
**Tiempo**: 60 min (referencias rápidas disponibles)  
**Secciones**:
**Parte 1 - Decisiones Técnicas (Justificadas)**:
- Node.js vs alternatives
- TypeScript vs JS puro
- Prisma vs otras ORMs
- PostgreSQL vs NoSQL
- JWT stateless auth
- Zod validation
- bcryptjs hashing
- OpenAI GPT-4
- Module-per-feature architecture

**Parte 2 - Troubleshooting (Indexed)**:
- 15+ errores comunes
- Causas raíz
- Soluciones paso a paso
- Scripts de diagnóstico
- Performance issues
- Debugging checklist

**Cuándo consultar**:
- Algo no funciona
- Necesitas entender una decisión
- Cuestionas tech stack
- Debugging en producción
- Code review de arquitectura

**Errores específicos cubiertos**:
- "Cannot find module @prisma/client"
- "P1001: Can't reach database"
- "OPENAI_API_KEY not set"
- "TypeScript compilation error"
- "Port 3000 already in use"
- "403 Forbidden"
- "401 Unauthorized"
- "OpenAI Rate Limit"
- "npm install behind VPN"
- + más

---

### 📅 [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md)  📍 **NUEVO**
**Contenido**: Fases 3-8 + cómo continuar desarrollo  
**Para quién**: Project managers, future developers  
**Tiempo**: 45 min (pueden saltar si solo necesitan Fase 3)  
**Secciones**:
- Roadmap completo (Fases 1-8)
- Status actual de cada fase
- Alcance detallado Fase 3-8
- Tech stack específico por fase
- Sprint recommendations
- Continuidad técnica
- Branch strategy
- Testing strategy
- Metrics de completitud
- Recursos y contactos

**Fases cubierta**s:
- ✅ Fase 1: Fundamentos (DONE)
- ✅ Fase 2: IA (DONE)
- 🔄 Fase 3: Mobile + App React Native
- 🔄 Fase 4: Webhooks & Async
- 🔄 Fase 5: Observability & Analytics
- 🔄 Fase 6: Testing & CI/CD
- 🔄 Fase 7: Performance & Scaling
- 🔄 Fase 8: Advanced Features

**Cuándo consultar**:
- Planificando Fase 3+
- Project manager necesita timeline
- New developer se une a Fase posterior
- Estimando esfuerzo
- Priorizando features

---

## 🎯 Guía Por Rol

### 👨‍💻 Backend Developer
**1. Primera vez**:
- [README.md](backend/README.md) - Quick start (5 min)
- [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md) - Setup (20 min)
- [test-complete-flow.ps1](backend/test-complete-flow.ps1) - Verify (10 min)

**2. Entender codebase**:
- [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md) - Capas (30 min)
- [06_DATABASE_DETALLADA.md](docs/06_DATABASE_DETALLADA.md) - Schema (30 min)

**3. Agregar feature nueva**:
- Re-lee modulo existente similar (src/modules/auth/)
- Sigue mismo pattern (controller, service, routes, validation)
- [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md#flujo-de-desarrollo) - Step by step

**4. Bug o problema**:
- [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md) - Busca error

**5. Codigo review**:
- [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md) - Consistencia
- [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#decisiones-técnicas-mayores) - Best practices

---

### 📱 Mobile Developer
**1. Setup**:
- [04_FASE2_API_IA.md](docs/04_FASE2_API_IA.md) - API endpoints (15 min)
- [test-complete-flow.ps1](backend/test-complete-flow.ps1) - Ver ejemplos (5 min)

**2. Integrar API**:
- [04_FASE2_API_IA.md - Error Handling](docs/04_FASE2_API_IA.md#posibles-errores)
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`

**3. Auth**:
- POST /auth/register → obtener user_id
- POST /auth/login → guardar JWT token secure
- Usar token en headers `Authorization: Bearer`

**4. Features IA**:
- POST /ai/:userId/routine - rutina personalizada
- POST /ai/:userId/nutrition - plan nutricional
- POST /ai/:userId/chat - chat libre
- GET /ai/:userId/tip - tip diario

**5. Problemas**:
- Check [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#error-401-unauthorized---invalid-token)

---

### 🏗️ Architect / Tech Lead
**Leer en orden**:
1. [02_ARQUITECTURA.md](docs/02_ARQUITECTURA.md) - Overview (5 min)
2. [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md) - Deep dive (45 min)
3. [06_DATABASE_DETALLADA.md](docs/06_DATABASE_DETALLADA.md) - Schema review (30 min)
4. [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md) - Decisions (30 min)
5. [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md) - Future (30 min)

**Para decision-making**:
- [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#decisiones-técnicas-mayores) - Why each choice

**Para onboarding teams**:
- Show [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md#diagrama-er-entity-relationship) diagrams
- Share [06_DATABASE_DETALLADA.md](docs/06_DATABASE_DETALLADA.md) for data modeling

---

### 📊 Project Manager
**Essentials only**:
1. [01_PLAN_DE_DESARROLLO.md](docs/01_PLAN_DE_DESARROLLO.md) - Project scope
2. [03_ROADMAP_TECNICO.md](docs/03_ROADMAP_TECNICO.md) - Current sprint
3. [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md) - Future fases

**For status reports**:
- [Status por Fase](docs/09_ROADMAP_CONTINUIDAD.md#-fases)
- [Sprint recommendations](docs/09_ROADMAP_CONTINUIDAD.md#sprints-sugeridos)

---

### 🚀 DevOps / Deployment
**Setup & Deployment**:
1. [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md) - Environment setup
2. [07_SETUP_CONFIGURACION.md - Docker](docs/07_SETUP_CONFIGURACION.md#-docker-setup-opcional-fase-3)
3. [07_SETUP_CONFIGURACION.md - Deployment](docs/07_SETUP_CONFIGURACION.md#-deployment-a-producción)

**Troubleshooting**:
- [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md)

**Monitoring**:
- [07_SETUP_CONFIGURACION.md - Monitoring](docs/07_SETUP_CONFIGURACION.md#-monitoreo-post-deployment)

---

## 🔍 Buscar Por Tema

### Autenticación
- JWT basics: [05_ARQUITECTURA_DETALLADA.md](docs/05_ARQUITECTURA_DETALLADA.md#autenticación-jwt)
- Setup JWT: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md#jwt-srcutilsjwtts)
- JWT errors: [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#error-401-unauthorized---invalid-token)

### Base de Datos
- Schema completo: [06_DATABASE_DETALLADA.md](docs/06_DATABASE_DETALLADA.md)
- Setup DB: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md#paso-4-setup-base-de-datos)
- Connection issues: [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#error-p1001-cant-reach-database-server)

### API
- Endpoints Fase 2: [04_FASE2_API_IA.md](docs/04_FASE2_API_IA.md#-endpoints)
- Error responses: [04_FASE2_API_IA.md](docs/04_FASE2_API_IA.md#-posibles-errores)
- Test script: [backend/test-complete-flow.ps1](backend/test-complete-flow.ps1)

### OpenAI / AI
- Config OpenAI: [04_FASE2_API_IA.md](docs/04_FASE2_API_IA.md#-configuración-openai)
- AI decision: [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#8-openai-gpt-4-para-rutinas)
- Setup API key: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md#paso-3-configurar-variables-de-entorno)
- Troubleshoot: [08_DECISIONES_TROUBLESHOOTING.md](docs/08_DECISIONES_TROUBLESHOOTING.md#error-openai_api_key-is-not-set)

### DevOps / Deployment
- Setup completo: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md)
- Docker: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md#-docker-setup-opcional-fase-3)
- Production: [07_SETUP_CONFIGURACION.md](docs/07_SETUP_CONFIGURACION.md#-deployment-a-producción)
- Staging fuera de red local: [11_DEPLOY_STAGING.md](docs/11_DEPLOY_STAGING.md)

### Próximas Fases
- Roadmap: [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md)
- Fase 3 Details: [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md#-fase-3-mobile-app-próxima)
- Sprints: [09_ROADMAP_CONTINUIDAD.md](docs/09_ROADMAP_CONTINUIDAD.md#-sprints-sugeridos)

---

## 📞 Referencias Rápidas

### File Structure
```
Agente_Gym/
├── docs/
│   ├── 01_PLAN_DE_DESARROLLO.md
│   ├── 02_ARQUITECTURA.md
│   ├── 03_ROADMAP_TECNICO.md
│   ├── 04_FASE2_API_IA.md
│   ├── 05_ARQUITECTURA_DETALLADA.md
│   ├── 06_DATABASE_DETALLADA.md
│   ├── 07_SETUP_CONFIGURACION.md
│   ├── 08_DECISIONES_TROUBLESHOOTING.md
│   ├── 09_ROADMAP_CONTINUIDAD.md
│   ├── 10_INDICE_DOCUMENTACION.md (este archivo)
│   └── 11_DEPLOY_STAGING.md
│
└── backend/
    ├── src/
    ├── prisma/
    ├── .env
    ├── README.md
    ├── package.json
    └── test-complete-flow.ps1
```

### Links Externos
- **Supabase**: https://app.supabase.com
- **OpenAI**: https://platform.openai.com
- **Node.js**: https://nodejs.org
- **Prisma Docs**: https://www.prisma.io/docs
- **Express**: https://expressjs.com
- **TypeScript**: https://www.typescriptlang.org

### Comandos Frecuentes
```bash
npm run dev              # Start dev server
npm run typecheck        # Validate TypeScript
npm run build            # Compile to JavaScript
npm run prisma:generate  # Update Prisma client
npm run start            # Run compiled app
```

### API Quick Test
```bash
# Health check
curl http://localhost:3000/health

# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456","fullName":"Test"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456"}'
```

---

## 📈 Progreso General

| Componente | Status | Docs | Tests | Deploy |
|-----------|--------|------|-------|--------|
| Backend (Node+Express) | ✅ | ✅ | ⏳ | ✅ Local |
| Database (Prisma+PG) | ✅ | ✅ | ✅ | ✅ Supabase |
| Auth (JWT) | ✅ | ✅ | ⏳ | ✅ |
| Users Module | ✅ | ✅ | ⏳ | ✅ |
| Measurements | ✅ | ✅ | ⏳ | ✅ |
| AI Module | ✅ | ✅ | ⏳ | 🔧 Pending API key |
| Mobile App | 🔄 | 📋 | ⏳ | 💭 |
| Webhooks | 📋 | 📋 | ⏳ | 💭 |
| Observability | 📋 | 📋 | ⏳ | 💭 |
| Testing | ⏳ | 📋 | ⏳ | 💭 |

**Leyenda**: ✅ Done | 🔄 In Progress | ⏳ Pending | 📋 Planned | 💭 Future | 🔧 Needs config

---

## 🤝 Convenciones

### Git Commits
```bash
feat: add new feature
fix: bug fix
docs: documentation
style: formatting
refactor: code refactoring
test: add tests
chore: maintenance
```

### Issue Naming
```
[FEAT] New feature name
[BUG] Bug description
[DOCS] Documentation update
[TECH] Technical debt
```

### Branch Names
```
feature/short-description
bugfix/issue-name
docs/update-guide
refactor/optimize-queries
```

---

## ✅ Completitud Esta Documentación

- [x] Plan original (Fase 1-7)
- [x] Arquitectura general
- [x] API Fase 2 completa
- [x] Database exhaustivo
- [x] Setup detallado
- [x] Troubleshooting
- [x] Roadmap futuro
- [x] Índice navegable
- [ ] Video tutorials (Fase 3+)
- [ ] Postman collection (Fase 3)

---

**Documento: Índice de Documentación**  
**Version**: 2.0  
**Última actualización**: Marzo 30, 2026  
**Status**: COMPLETAMENTE DOCUMENTADO ✅

Para preguntas o actualizaciones, referirse a los mantenedores del proyecto.
