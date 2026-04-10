# Tuco - Plan de Desarrollo

## Resumen del Proyecto

**Tuco** es una aplicacion movil (iOS + Android) que conecta una inteligencia artificial con los usuarios de un gimnasio para ofrecer:
- Recomendaciones personalizadas de ejercicios y rutinas
- Planes de alimentación adaptados
- Seguimiento de progreso en tiempo real
- Alertas inteligentes (ej: recomendar fisioterapia si detecta estancamiento o riesgo)

**Alcance inicial:** MVP para 1 gimnasio  
**Tipo de proyecto:** Aprendizaje + producto funcional  

---

## 📱 Stack Tecnológico Recomendado

| Capa | Tecnología | Razón |
|------|-----------|-------|
| **App Móvil** | React Native + Expo | Un solo código para iOS y Android. Gran comunidad, ideal para aprender |
| **Backend / API** | Node.js + Express (o NestJS) | JavaScript en todo el stack. Fácil de aprender, muy documentado |
| **Base de Datos** | PostgreSQL + Prisma ORM | Relacional, robusto, gratis. Prisma simplifica el manejo de datos |
| **Autenticación** | Supabase Auth (o Firebase Auth) | Gratis en nivel básico, fácil integración, manejo de roles |
| **Motor IA** | OpenAI API (GPT-4o-mini) | Mejor relación costo/beneficio. ~$0.15 por 1M tokens input |
| **Almacenamiento** | Supabase Storage | Para fotos de progreso del usuario |
| **Hosting Backend** | Railway / Render (gratis para MVP) | Deploy fácil, sin configurar servidores |
| **Hosting DB** | Supabase (gratis tier) | PostgreSQL gestionado, incluye auth y storage |

### ¿Por qué este stack?
- **JavaScript/TypeScript en todo:** Solo necesitas aprender un lenguaje
- **Costos mínimos:** Todo tiene tier gratuito suficiente para un MVP
- **Gran documentación:** Todas son tecnologías populares con mucha comunidad en español

---

## 👥 Roles de Usuario

### 1. Dueño / Administrador del Gimnasio
- Registra nuevos usuarios en el sistema
- Ve métricas generales del gimnasio
- Gestiona membresías y accesos

### 2. Usuario / Miembro del Gimnasio
- Ve su perfil con datos físicos
- Recibe recomendaciones de la IA
- Registra su progreso (peso, medidas, fotos)
- Chatea con la IA para preguntas específicas
- Ve historial de rutinas y alimentación

---

## 🗄️ Modelo de Base de Datos (Entidades Principales)

```
┌─────────────────┐     ┌──────────────────────┐
│     GYM          │     │       USER            │
├─────────────────┤     ├──────────────────────┤
│ id              │────<│ id                    │
│ name            │     │ gym_id                │
│ owner_name      │     │ email                 │
│ address         │     │ password_hash         │
│ phone           │     │ full_name             │
│ created_at      │     │ role (admin/member)   │
└─────────────────┘     │ created_at            │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────────┐
                    │              │                   │
          ┌─────────▼──────┐ ┌────▼──────────┐ ┌─────▼──────────┐
          │  USER_PROFILE   │ │  MEASUREMENT   │ │  AI_CHAT_LOG   │
          ├────────────────┤ ├───────────────┤ ├────────────────┤
          │ user_id        │ │ user_id       │ │ user_id        │
          │ birth_date     │ │ date          │ │ timestamp      │
          │ height_cm      │ │ weight_kg     │ │ user_message   │
          │ goal           │ │ body_fat_%    │ │ ai_response    │
          │ medical_conds  │ │ muscle_mass   │ │ context_type   │
          │ injuries       │ │ chest_cm      │ └────────────────┘
          │ experience_lvl │ │ waist_cm      │
          │ availability   │ │ hip_cm        │
          │ diet_prefs     │ │ arm_cm        │
          └────────────────┘ │ photo_url     │
                             └───────────────┘
                    │
          ┌─────────▼──────────┐  ┌──────────────────┐
          │  ROUTINE            │  │  NUTRITION_PLAN   │
          ├────────────────────┤  ├──────────────────┤
          │ id                 │  │ id               │
          │ user_id            │  │ user_id          │
          │ generated_by_ai    │  │ generated_by_ai  │
          │ name               │  │ date_range       │
          │ description        │  │ calories_target  │
          │ difficulty         │  │ protein_g        │
          │ date_range         │  │ carbs_g          │
          │ status (active/..) │  │ fats_g           │
          └────────┬───────────┘  │ meals_json       │
                   │              │ status           │
          ┌────────▼───────────┐  └──────────────────┘
          │  ROUTINE_EXERCISE   │
          ├────────────────────┤
          │ routine_id         │
          │ exercise_name      │
          │ sets               │
          │ reps               │
          │ rest_seconds       │
          │ day_of_week        │
          │ notes              │
          └────────────────────┘

          ┌──────────────────────┐
          │  PROGRESS_LOG        │
          ├──────────────────────┤
          │ id                   │
          │ user_id              │
          │ routine_exercise_id  │
          │ date                 │
          │ weight_used          │
          │ reps_done            │
          │ perceived_effort     │
          │ notes                │
          └──────────────────────┘
```

---

## 🤖 Cómo Funciona la IA

### Arquitectura de Prompts

La IA NO tiene acceso directo a la base de datos. En su lugar:

1. **El backend consulta la BD** y construye un contexto (prompt) con los datos del usuario
2. **Se envía a la API de OpenAI** el contexto + la solicitud del usuario
3. **La respuesta de la IA** se parsea y se guarda en la BD

```
[Usuario abre app] 
    → [App pide rutina al Backend]
    → [Backend consulta BD: perfil, medidas, historial, progreso]
    → [Backend construye prompt con TODO el contexto]
    → [Backend envía prompt a OpenAI API]
    → [OpenAI responde con rutina personalizada]
    → [Backend parsea, guarda en BD, envía a la App]
    → [Usuario ve su rutina personalizada]
```

### Ejemplo de Prompt del Sistema

```
Eres un entrenador personal experto y nutricionista certificado.

DATOS DEL USUARIO:
- Nombre: Carlos Pérez
- Edad: 28 años
- Peso actual: 82 kg | Altura: 175 cm | IMC: 26.8
- Grasa corporal: 22%
- Objetivo: Perder grasa y ganar masa muscular
- Condiciones médicas: Dolor lumbar leve
- Lesiones: Esguince de tobillo derecho (hace 6 meses, ya recuperado)
- Nivel de experiencia: Intermedio
- Disponibilidad: 4 días por semana, 1 hora por sesión
- Preferencias alimentarias: Sin lactosa

HISTORIAL RECIENTE:
- Peso hace 1 mes: 84 kg (bajó 2 kg ✓)
- Última rutina: Push/Pull/Legs - completó 90% de los ejercicios
- Ejercicio donde más mejoró: Press banca (60kg → 65kg)
- Ejercicio donde se estancó: Sentadilla (80kg, sin cambio en 3 semanas)

INSTRUCCIÓN: Genera la rutina de la próxima semana considerando su 
progreso, ajustando los ejercicios donde se estancó y respetando 
sus limitaciones físicas.

Responde en formato JSON con la estructura: { exercises: [...] }
```

### Tipos de Interacción con la IA

| Función | Trigger | Frecuencia |
|---------|---------|------------|
| Generar rutina semanal | Automático cada lunes / a demanda | Semanal |
| Plan de alimentación | Automático con nueva medición / a demanda | Quincenal |
| Chat libre | El usuario pregunta algo | Ilimitado |
| Alerta de fisioterapia | IA detecta estancamiento o dolor reportado | Automático |
| Ajuste de rutina | Tras registrar progreso semanal | Semanal |
| Motivación / tips | Push notification diaria | Diario |

---

## 📋 Fases de Desarrollo (Roadmap)

### 🔵 FASE 1 — Fundamentos (Semanas 1-3)
> **Objetivo:** Tener el backend funcionando con la base de datos

- [ ] Configurar proyecto Node.js + TypeScript
- [ ] Configurar PostgreSQL con Supabase
- [ ] Definir esquema de BD con Prisma ORM
- [ ] Crear endpoints CRUD:
  - `POST /auth/register` — Registro (solo admin puede crear users)
  - `POST /auth/login` — Login con JWT
  - `GET /users/:id/profile` — Obtener perfil
  - `PUT /users/:id/profile` — Actualizar perfil
  - `POST /users/:id/measurements` — Registrar medida
  - `GET /users/:id/measurements` — Historial de medidas
- [ ] Implementar autenticación con JWT + roles (admin/member)
- [ ] Documentar API con Swagger

**Entregable:** API funcional, testeada con Postman/Thunder Client

---

### 🟢 FASE 2 — Integración de IA (Semanas 4-5)
> **Objetivo:** La IA genera recomendaciones basadas en datos reales

- [ ] Crear servicio de integración con OpenAI API
- [ ] Diseñar sistema de prompts (prompt engineering):
  - Prompt base del sistema (personalidad del entrenador)
  - Template de contexto del usuario
  - Templates por tipo de solicitud (rutina, nutrición, chat)
- [ ] Crear endpoints:
  - `POST /ai/routine` — Generar rutina personalizada
  - `POST /ai/nutrition` — Generar plan alimenticio
  - `POST /ai/chat` — Chat libre con la IA
  - `GET /ai/alerts/:userId` — Obtener alertas inteligentes
- [ ] Implementar parseo de respuestas JSON de la IA
- [ ] Guardar todas las interacciones en `ai_chat_log`
- [ ] Implementar caché para evitar llamadas repetitivas a la API

**Entregable:** Endpoints de IA funcionando, probados con datos reales

---

### 🟡 FASE 3 — App Móvil (Semanas 6-9)
> **Objetivo:** Interfaz móvil funcional conectada al backend

- [ ] Configurar proyecto React Native con Expo
- [ ] Implementar navegación (React Navigation):
  - Stack de autenticación (Login)
  - Tab navigator principal (Home, Rutina, Nutrición, Progreso, Chat)
- [ ] Pantallas del **miembro**:
  - 🏠 Home: resumen del día, tip de IA, próximo ejercicio
  - 🏋️ Mi Rutina: rutina actual, marcar ejercicios hechos
  - 🥗 Nutrición: plan alimenticio, recetas sugeridas
  - 📊 Progreso: gráficas de peso, medidas, fotos comparativas
  - 💬 Chat IA: conversación con el entrenador virtual
  - 👤 Perfil: datos personales, editar info
- [ ] Pantallas del **administrador**:
  - 📋 Lista de usuarios del gimnasio
  - ➕ Registrar nuevo miembro
  - 👁️ Ver perfil/progreso de cualquier miembro
  - 📊 Dashboard básico (total miembros, activos, etc.)
- [ ] Integrar llamadas a la API (Axios/Fetch)
- [ ] Manejo de estado (Zustand o Context API)
- [ ] Almacenamiento local de sesión (AsyncStorage)

**Entregable:** App móvil funcional en emulador/dispositivo físico

---

### 🟠 FASE 4 — Progreso y Métricas (Semanas 10-11)
> **Objetivo:** El usuario registra su progreso y la IA se adapta

- [ ] Formulario para registrar progreso de cada ejercicio
- [ ] Registro de mediciones corporales periódicas
- [ ] Subida de fotos de progreso (antes/después)
- [ ] Gráficas de evolución (react-native-chart-kit):
  - Peso a lo largo del tiempo
  - Medidas corporales
  - Peso levantado por ejercicio
  - Porcentaje de rutina completado
- [ ] Sistema de alertas inteligentes:
  - "Llevas 3 semanas sin mejorar en sentadilla → ¿probar variante?"
  - "Tu peso subió pero tu grasa bajó → estás ganando músculo 💪"
  - "Reportaste dolor en hombro 2 veces → considerar fisioterapia"
- [ ] Push notifications (Expo Notifications)

**Entregable:** Sistema de tracking completo con alertas

---

### 🔴 FASE 5 — Pulido y Deploy (Semanas 12-14)
> **Objetivo:** App lista para producción

- [ ] Testing E2E (Jest + React Native Testing Library)
- [ ] Manejo de errores robusto (error boundaries, retries)
- [ ] Optimización de rendimiento
- [ ] Diseño UI/UX final (estilos, animaciones, dark mode)
- [ ] Deploy backend en Railway/Render
- [ ] Build de la app:
  - Android: APK para distribución / Google Play
  - iOS: TestFlight (requiere cuenta de Apple Developer $99/año)
- [ ] Documentación del usuario (guía rápida)

**Entregable:** Aplicación desplegada y usable

---

## 💰 Estimación de Costos (MVP)

| Recurso | Costo |
|---------|-------|
| Supabase (DB + Auth + Storage) | **$0** (tier gratis: 500MB DB, 1GB storage) |
| Railway/Render (Backend hosting) | **$0** (tier gratis limitado) o ~$5/mes |
| OpenAI API (GPT-4o-mini) | ~**$1-5/mes** para ~50 usuarios activos |
| Expo (Build de app) | **$0** (tier gratis: 30 builds/mes) |
| Cuenta Google Play | **$25** (pago único) |
| Cuenta Apple Developer | **$99/año** (opcional, solo si quieres iOS en App Store) |
| **Total MVP mensual** | **~$1-10/mes** |

---

## 🛠️ Lo Que Necesitas para Empezar

### Software (todo gratuito)
1. **VS Code** — Editor de código (ya lo tienes ✓)
2. **Node.js v20+** — Runtime de JavaScript → [nodejs.org](https://nodejs.org)
3. **Git** — Control de versiones → [git-scm.com](https://git-scm.com)
4. **Expo CLI** — Para React Native → `npm install -g expo-cli`
5. **Expo Go** (app en tu celular) — Para probar la app en tu dispositivo
6. **Postman / Thunder Client** — Para probar el API
7. **Android Studio** (opcional) — Emulador Android

### Cuentas (todas gratis)
1. **GitHub** — Para guardar tu código
2. **Supabase** — Base de datos y autenticación
3. **OpenAI Platform** — API de inteligencia artificial (~$5 de crédito gratis)
4. **Railway o Render** — Para hostear el backend

### Conocimientos Recomendados
| Tema | Nivel necesario | Recurso sugerido |
|------|----------------|-------------------|
| JavaScript/TypeScript | Básico-Intermedio | freeCodeCamp, MDN Web Docs |
| React | Básico | React.dev (docs oficiales) |
| React Native + Expo | Básico | docs.expo.dev |
| Node.js + Express | Básico | expressjs.com |
| SQL / PostgreSQL | Básico | sqlbolt.com |
| Git | Básico | learngitbranching.js.org |
| REST APIs | Conceptual | restfulapi.net |

---

## 📂 Estructura del Proyecto

```
Agente_Gym/
├── docs/                     # Documentación del proyecto
│   ├── 01_PLAN_DE_DESARROLLO.md
│   └── 02_ARQUITECTURA.md
│
├── backend/                  # API + Lógica de negocio
│   ├── src/
│   │   ├── config/           # Configuración (DB, env vars)
│   │   ├── modules/
│   │   │   ├── auth/         # Registro, login, JWT
│   │   │   ├── users/        # CRUD usuarios y perfiles
│   │   │   ├── measurements/ # Mediciones corporales
│   │   │   ├── routines/     # Rutinas de ejercicio
│   │   │   ├── nutrition/    # Planes nutricionales
│   │   │   ├── progress/     # Registro de progreso
│   │   │   └── ai/           # Integración OpenAI
│   │   ├── middleware/       # Auth, error handling
│   │   ├── utils/            # Helpers, prompt templates
│   │   └── app.ts            # Entry point
│   ├── prisma/
│   │   └── schema.prisma     # Esquema de base de datos
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                   # App React Native
│   ├── src/
│   │   ├── screens/          # Pantallas de la app
│   │   ├── components/       # Componentes reutilizables
│   │   ├── navigation/       # Configuración de navegación
│   │   ├── services/         # Llamadas a la API
│   │   ├── store/            # Estado global (Zustand)
│   │   ├── hooks/            # Custom hooks
│   │   └── utils/            # Helpers
│   ├── assets/               # Imágenes, fuentes
│   ├── app.json
│   └── package.json
│
└── README.md
```

---

## ⏭️ Próximos Pasos Inmediatos

Cuando estés listo para empezar, lo que haremos es:

1. **Verificar que tienes Node.js y Git instalados**
2. **Crear la estructura del proyecto** (backend + mobile)
3. **Configurar el backend** con Express + TypeScript + Prisma
4. **Crear la base de datos** en Supabase
5. **Implementar los primeros endpoints** (auth + perfil)

> 💡 **Nota:** Este plan está diseñado para alguien aprendiendo. Cada fase 
> construye sobre la anterior y te permite ir aprendiendo las tecnologías 
> de forma progresiva. No necesitas saber todo desde el inicio.

---

*Documento creado: Marzo 2026*  
*Última actualización: Marzo 2026*
