# 🏗️ GymAI — Arquitectura del Sistema

## Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    USUARIO (Celular)                     │
│                                                         │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  📱 App     │  │ 💬 Chat  │  │ 📊 Progreso       │  │
│  │  React      │  │   IA     │  │   Gráficas        │  │
│  │  Native     │  │          │  │                   │  │
│  └──────┬──────┘  └────┬─────┘  └────────┬──────────┘  │
│         │              │                  │              │
└─────────┼──────────────┼──────────────────┼──────────────┘
          │              │                  │
          ▼              ▼                  ▼
   ─────────── HTTPS (REST API) ───────────────
          │              │                  │
┌─────────┼──────────────┼──────────────────┼──────────────┐
│         ▼              ▼                  ▼              │
│  ┌─────────────────────────────────────────────────┐    │
│  │           🖥️ BACKEND (Node.js + Express)         │    │
│  │                                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │   Auth   │ │  Users   │ │   AI Service     │ │    │
│  │  │ Module   │ │  Module  │ │   (Prompt Eng.)  │─┼────┼──→ OpenAI API
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │ Routines │ │Nutrition │ │   Progress       │ │    │
│  │  │ Module   │ │  Module  │ │   Module         │ │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                  │
│              ┌────────▼────────┐                        │
│              │  Prisma ORM     │                        │
│              └────────┬────────┘                        │
│                       │                                  │
│  ┌────────────────────▼──────────────────────────────┐  │
│  │              🗄️ PostgreSQL (Supabase)               │  │
│  │  ┌──────┐ ┌────────┐ ┌─────────┐ ┌────────────┐  │  │
│  │  │Users │ │Profiles│ │Measures │ │AI Chat Logs│  │  │
│  │  └──────┘ └────────┘ └─────────┘ └────────────┘  │  │
│  │  ┌────────┐ ┌───────────┐ ┌──────────────────┐   │  │
│  │  │Routines│ │ Nutrition │ │  Progress Logs   │   │  │
│  │  └────────┘ └───────────┘ └──────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│                  ☁️ CLOUD (Railway / Render)              │
└──────────────────────────────────────────────────────────┘
```

---

## Flujos Principales

### 1. Registro de Nuevo Miembro (Admin)

```
Admin abre app
  → Pantalla "Registrar Miembro"
  → Ingresa: email, nombre, contraseña temporal
  → POST /auth/register { email, name, tempPassword, role: "member" }
  → Backend crea usuario con role "member"
  → Backend envía respuesta con userId
  → Admin completa perfil: peso, altura, objetivos, condiciones
  → PUT /users/:id/profile { height, goals, conditions, injuries... }
  → Listo. El miembro puede hacer login con su email
```

### 2. Primera Sesión del Miembro

```
Miembro hace login
  → POST /auth/login { email, password }
  → Recibe JWT token
  → App almacena token en AsyncStorage
  → App navega a Home
  → Home llama GET /users/me/profile → muestra datos
  → Home llama GET /ai/tip → IA genera tip del día
  → Miembro toca "Generar Mi Rutina"
  → POST /ai/routine
       → Backend arma contexto con TODOS los datos del user
       → Envía a OpenAI con prompt estructurado
       → Parsea respuesta JSON
       → Guarda rutina en BD
       → Devuelve rutina al frontend
  → Miembro ve su primera rutina personalizada
```

### 3. Registro de Progreso

```
Miembro termina entrenamiento
  → Abre pantalla de rutina actual
  → Por cada ejercicio marca: ✅ completado
  → Registra: peso usado, repeticiones logradas, esfuerzo percibido
  → POST /progress { routineExerciseId, weightUsed, repsDone, effort }
  → Backend guarda en progress_log
  → Si es fin de semana: trigger automático para que IA analice la semana
  → IA compara progreso vs semana anterior
  → Genera nueva rutina ajustada para siguiente semana
```

### 4. Chat con IA

```
Miembro abre Chat
  → GET /ai/chat/history → muestra mensajes previos
  → Miembro escribe: "Me duele la rodilla al hacer sentadillas"
  → POST /ai/chat { message: "Me duele la rodilla..." }
  → Backend:
       1. Consulta perfil + historial del usuario
       2. Consulta últimas rutinas y progreso
       3. Arma prompt con contexto completo
       4. Agrega el mensaje del usuario
       5. Envía a OpenAI
  → IA responde con contexto médico:
       "Dado tu historial de esguince de tobillo hace 6 meses,
        el dolor en la rodilla podría estar relacionado con 
        compensación. Te recomiendo:
        1. Sustituir sentadilla por prensa de piernas esta semana
        2. Agregar ejercicios de movilidad de tobillo
        3. Si el dolor persiste más de 5 días, consulta un fisioterapeuta"
  → Respuesta se guarda en ai_chat_log
  → Si la IA detecta riesgo → genera alerta automática
```

### 5. Alertas Inteligentes

```
Cada lunes el backend ejecuta un cron job:
  → Para cada usuario activo:
       1. Consulta mediciones últimas 4 semanas
       2. Consulta progreso en ejercicios
       3. Consulta reportes de dolor/molestia
       4. Envía a IA para análisis
       5. IA clasifica:
          - 🟢 Progreso normal → no alerta
          - 🟡 Estancamiento → sugerir variación de rutina
          - 🔴 Posible riesgo → recomendar fisioterapia
       6. Si hay alerta → push notification al usuario
       7. Guardar alerta en BD
```

---

## Seguridad

| Aspecto | Implementación |
|---------|---------------|
| **Autenticación** | JWT con refresh tokens. Tokens expiran en 1 hora |
| **Autorización** | Middleware de roles: admin puede ver todo, member solo su data |
| **Passwords** | bcrypt con salt rounds = 12 |
| **API Keys** | OpenAI key SOLO en backend, nunca en el frontend |
| **HTTPS** | Obligatorio en producción (Railway/Render lo incluyen) |
| **Rate Limiting** | Limitar llamadas a IA: máx 20 chats/día por usuario |
| **Datos Médicos** | Encriptar campos sensibles (condiciones, lesiones) |
| **Input Validation** | Validar TODA entrada con Zod (schema validation) |

---

## API Endpoints Detallados

### Auth
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/auth/register` | Registrar miembro (admin crea la cuenta) | Admin |
| POST | `/auth/login` | Iniciar sesión | Público |
| POST | `/auth/refresh` | Renovar JWT | Autenticado |
| POST | `/auth/change-password` | Cambiar contraseña | Autenticado |

### Users
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/users/me` | Mi perfil completo | Autenticado |
| PUT | `/users/me/profile` | Actualizar mi perfil | Member |
| GET | `/users` | Listar todos los miembros | Admin |
| GET | `/users/:id` | Ver perfil de un miembro | Admin |
| DELETE | `/users/:id` | Desactivar miembro | Admin |

### Measurements (Mediciones)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/users/me/measurements` | Registrar nueva medición | Member |
| GET | `/users/me/measurements` | Mi historial de mediciones | Member |
| GET | `/users/:id/measurements` | Mediciones de un miembro | Admin |

### Routines (Rutinas)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/routines/current` | Mi rutina activa | Member |
| GET | `/routines/history` | Historial de rutinas | Member |
| POST | `/routines/generate` | Pedir nueva rutina a la IA | Member |

### Nutrition (Nutrición)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/nutrition/current` | Mi plan nutricional activo | Member |
| POST | `/nutrition/generate` | Pedir plan a la IA | Member |
| GET | `/nutrition/history` | Historial de planes | Member |

### Progress (Progreso)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/progress` | Registrar progreso de ejercicio | Member |
| GET | `/progress/summary` | Resumen de progreso | Member |
| GET | `/progress/exercise/:id` | Progreso por ejercicio | Member |

### AI (Inteligencia Artificial)
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/ai/chat` | Enviar mensaje al chat | Member |
| GET | `/ai/chat/history` | Historial de chat | Member |
| GET | `/ai/tip` | Tip del día | Member |
| GET | `/ai/alerts` | Mis alertas activas | Member |

### Admin Dashboard
| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| GET | `/admin/stats` | Estadísticas del gym | Admin |
| GET | `/admin/members/active` | Miembros activos | Admin |

---

## Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/gymaidb

# Auth
JWT_SECRET=tu-clave-secreta-muy-larga
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000

# App
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:19006

# Supabase (Storage para fotos)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

---

*Documento de Arquitectura — GymAI*  
*Marzo 2026*
