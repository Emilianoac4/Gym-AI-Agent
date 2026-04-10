# Tuco - Roadmap Tecnico Semana a Semana

## Cómo Usar Este Roadmap

Cada semana tiene:
- 🎯 **Objetivo claro** de lo que vas a lograr
- 📚 **Lo que aprenderás** (conceptos nuevos)
- ✅ **Tareas concretas** paso a paso
- 🧪 **Cómo validar** que lo hiciste bien
- 💡 **Tips** para no atascarte

---

## 🔵 FASE 1 — Fundamentos del Backend

### Semana 1: Setup del Proyecto + Base de Datos

🎯 **Objetivo:** Tener el proyecto creado con la BD funcionando

📚 **Aprenderás:** TypeScript, Prisma ORM, PostgreSQL, estructura de proyecto

✅ **Tareas:**
1. Instalar Node.js, Git, y crear cuenta en GitHub
2. Crear repositorio `tuco` en GitHub
3. Inicializar proyecto backend:
   ```bash
   mkdir backend && cd backend
   npm init -y
   npm install express typescript ts-node @types/express @types/node
   npm install prisma @prisma/client
   npx tsc --init
   npx prisma init
   ```
4. Crear cuenta en Supabase y obtener DATABASE_URL
5. Definir el esquema completo en `prisma/schema.prisma`
6. Ejecutar `npx prisma migrate dev --name init`
7. Verificar tablas creadas en Supabase Dashboard
8. Crear estructura de carpetas del backend (config, modules, middleware, utils)

🧪 **Validación:** Puedes conectar a Supabase y ver las tablas creadas

💡 **Tip:** Si te confundes con TypeScript, empieza leyendo la guía de 5 minutos: typescriptlang.org/docs/handbook/typescript-in-5-minutes.html

---

### Semana 2: Autenticación (Register + Login)

🎯 **Objetivo:** Endpoints de registro y login funcionando con JWT

📚 **Aprenderás:** bcrypt, JWT, middleware de autenticación, roles

✅ **Tareas:**
1. Instalar dependencias:
   ```bash
   npm install bcryptjs jsonwebtoken dotenv cors
   npm install @types/bcryptjs @types/jsonwebtoken @types/cors -D
   npm install zod  # Para validación de inputs
   ```
2. Crear archivo `.env` con variables de entorno
3. Crear `src/config/database.ts` — conexión a Prisma
4. Crear `src/config/env.ts` — cargar variables de entorno
5. Crear `src/modules/auth/auth.controller.ts`:
   - `register()` — Solo admin puede crear cuentas
   - `login()` — Devuelve JWT con userId y role
6. Crear `src/middleware/auth.middleware.ts`:
   - `authenticate()` — Verifica JWT en headers
   - `authorize(roles)` — Verifica que el role tenga permiso
7. Crear `src/modules/auth/auth.routes.ts` — Definir rutas
8. Crear `src/app.ts` — Express app con middleware y rutas
9. Probar con Postman/Thunder Client:
   - Registrar un admin
   - Registrar un member (usando token de admin)
   - Login con member
   - Intentar acceder a ruta protegida

🧪 **Validación:** Login devuelve un JWT. Rutas protegidas rechazan peticiones sin token.

💡 **Tip:** Instala la extensión "Thunder Client" en VS Code para probar tu API sin salir del editor.

---

### Semana 3: CRUD de Usuarios y Perfiles

🎯 **Objetivo:** Poder crear, leer y actualizar perfiles de usuario con mediciones

📚 **Aprenderás:** Controllers, Services, validación de datos, query con Prisma

✅ **Tareas:**
1. Crear `src/modules/users/`:
   - `users.controller.ts` — Handlers de HTTP
   - `users.service.ts` — Lógica de negocio
   - `users.routes.ts` — Rutas
   - `users.validation.ts` — Schemas de Zod
2. Implementar endpoints:
   - `GET /users/me` — Perfil propio (member)
   - `PUT /users/me/profile` — Actualizar perfil
   - `GET /users` — Lista de miembros (admin)
   - `GET /users/:id` — Ver un miembro (admin)
3. Crear `src/modules/measurements/`:
   - `POST /users/me/measurements` — Nueva medición
   - `GET /users/me/measurements` — Historial
4. Agregar validación con Zod en cada endpoint
5. Agregar manejo de errores global (`src/middleware/error.middleware.ts`)
6. Documentar con Swagger (swagger-jsdoc + swagger-ui-express)

🧪 **Validación:** Puedes crear un usuario, llenar su perfil, registrar 3 mediciones, y consultar el historial. La documentación Swagger está en `/api/docs`.

---

## 🟢 FASE 2 — Integración de IA

### Semana 4: Servicio de IA + Generador de Rutinas

🎯 **Objetivo:** La IA genera una rutina personalizada basada en datos reales

📚 **Aprenderás:** OpenAI API, prompt engineering, parseo de JSON

✅ **Tareas:**
1. Crear cuenta en OpenAI Platform y obtener API key
2. Instalar: `npm install openai`
3. Crear `src/modules/ai/`:
   - `ai.service.ts` — Clase principal de comunicación con OpenAI
   - `ai.prompts.ts` — Templates de prompts
   - `ai.controller.ts` — Handlers
   - `ai.routes.ts` — Rutas
4. Diseñar el **prompt del sistema** (personalidad del entrenador IA)
5. Crear función `buildUserContext(userId)`:
   - Consulta perfil, mediciones, historial de rutinas, progreso
   - Devuelve un string con todo el contexto formateado
6. Implementar `POST /routines/generate`:
   - Construye contexto → arma prompt → llama a OpenAI → parsea JSON
   - Guarda la rutina en la tabla `routines` + `routine_exercises`
   - Devuelve la rutina al frontend
7. Crear `src/modules/routines/`:
   - `GET /routines/current` — Rutina activa
   - `GET /routines/history` — Historial
8. Probar con datos reales: crear usuario, llenar perfil, generar rutina

🧪 **Validación:** Puedes generar una rutina con la IA y los ejercicios tienen sentido según el perfil del usuario.

💡 **Tip:** Usa `gpt-4o-mini` para desarrollar (más barato). El modelo cuesta ~$0.15/1M tokens de input.

---

### Semana 5: Chat + Nutrición + Alertas

🎯 **Objetivo:** Chat funcional con IA, planes nutricionales, y sistema de alertas

📚 **Aprenderás:** Conversaciones con contexto, cron jobs, sistema de notificaciones

✅ **Tareas:**
1. Implementar **Chat con IA**:
   - `POST /ai/chat` — Envía mensaje, recibe respuesta con contexto completo
   - `GET /ai/chat/history` — Historial de conversación
   - Guardar cada interacción en `ai_chat_log`
2. Implementar **Plan Nutricional**:
   - `POST /nutrition/generate` — Genera plan basado en perfil + objetivo
   - `GET /nutrition/current` — Plan activo
   - Diseñar prompt específico para nutrición
3. Implementar **Tip del Día**:
   - `GET /ai/tip` — Genera un consejo personalizado diario
   - Cachear para no llamar a OpenAI cada vez (1 tip por día)
4. Implementar **Sistema de Alertas** (básico):
   - Función `analyzeUserProgress(userId)` que revisa:
     - ¿Hay estancamiento (mismo peso en ejercicio por 3+ semanas)?
     - ¿Reportó dolor o molestia en el chat?
     - ¿Dejó de registrar progreso (inactivo)?
   - `GET /ai/alerts` — Alertas activas del usuario
5. Agregar **rate limiting** en endpoints de IA

🧪 **Validación:** Puedes chatear con la IA y las respuestas reflejan los datos reales del usuario. Puedes generar un plan nutricional coherente.

---

## 🟡 FASE 3 — App Móvil

### Semana 6: Setup + Navegación + Login

🎯 **Objetivo:** App móvil con login funcional conectada al backend

📚 **Aprenderás:** React Native, Expo, React Navigation, AsyncStorage

✅ **Tareas:**
1. Crear proyecto Expo:
   ```bash
   npx create-expo-app@latest mobile --template blank-typescript
   ```
2. Instalar dependencias:
   ```bash
   npx expo install @react-navigation/native @react-navigation/stack
   npx expo install @react-navigation/bottom-tabs
   npx expo install react-native-screens react-native-safe-area-context
   npm install axios @react-native-async-storage/async-storage
   npm install zustand  # Estado global
   ```
3. Crear estructura de carpetas (screens, components, services, store, hooks)
4. Crear `src/services/api.ts` — Axios client con baseURL y interceptors
5. Crear `src/store/authStore.ts` — Estado de autenticación con Zustand
6. Crear pantallas:
   - `LoginScreen.tsx` — Formulario de login
   - `HomeScreen.tsx` — Placeholder
7. Configurar navegación:
   - `AuthStack` — Login (cuando no hay token)
   - `MainTabs` — Home, Rutina, Nutrición, Progreso, Chat
8. Probar login real contra el backend

🧪 **Validación:** Puedes hacer login desde la app y navegar a la pantalla Home.

💡 **Tip:** Usa Expo Go en tu celular para ver cambios en tiempo real.

---

### Semana 7: Pantallas de Perfil y Rutinas

🎯 **Objetivo:** El usuario puede ver su perfil y su rutina actual

✅ **Tareas:**
1. `ProfileScreen.tsx`:
   - Muestra datos del perfil
   - Botón para editar
   - Sección de mediciones actuales
2. `EditProfileScreen.tsx`:
   - Formulario para actualizar datos
3. `RoutineScreen.tsx`:
   - Muestra rutina actual con ejercicios por día
   - Cada ejercicio muestra: nombre, series, reps, descanso
   - Botón "Generar Nueva Rutina" → llama a la IA
4. `ExerciseDetailScreen.tsx`:
   - Detalle de un ejercicio
   - Botón para registrar progreso
5. Crear componentes reutilizables:
   - `Card.tsx`, `Button.tsx`, `Input.tsx`
   - `ExerciseCard.tsx`, `MeasurementCard.tsx`

🧪 **Validación:** Puedes ver tu perfil y tu rutina generada por IA en la app.

---

### Semana 8: Nutrición + Chat con IA

🎯 **Objetivo:** Chat funcional + plan de nutrición visible en la app

✅ **Tareas:**
1. `NutritionScreen.tsx`:
   - Plan actual: calorías, macros, comidas
   - Botón "Generar Nuevo Plan"
   - Historial de planes
2. `ChatScreen.tsx`:
   - Interfaz tipo WhatsApp/ChatGPT
   - Mensajes del usuario a la derecha, IA a la izquierda
   - Input de texto + botón enviar
   - Scroll automático al último mensaje
   - Indicador de "IA pensando..."
3. `AlertsComponent.tsx`:
   - Banner en Home si hay alertas activas
   - Detalles de la alerta con recomendación de la IA

🧪 **Validación:** Puedes chatear con la IA desde la app y ver tu plan nutricional.

---

### Semana 9: Pantallas de Admin

🎯 **Objetivo:** El admin puede gestionar usuarios desde la app

✅ **Tareas:**
1. `AdminMembersScreen.tsx`:
   - Lista de miembros con búsqueda
   - Badge de activo/inactivo
2. `RegisterMemberScreen.tsx`:
   - Formulario de registro de nuevo miembro
   - Ingreso de perfil inicial (peso, altura, objetivo, condiciones)
3. `MemberDetailScreen.tsx` (vista admin):
   - Perfil completo del miembro
   - Historial de mediciones
   - Rutina actual
   - Progreso
4. `AdminDashboardScreen.tsx`:
   - Total de miembros
   - Miembros activos esta semana
   - Alertas pendientes
5. Navegación condicional: si role === "admin", mostrar tabs de admin

🧪 **Validación:** El admin puede registrar un nuevo miembro y ver su información completa.

---

## 🟠 FASE 4 — Progreso y Métricas

### Semana 10: Registro de Progreso

🎯 **Objetivo:** El usuario registra su avance en cada ejercicio

✅ **Tareas:**
1. `LogProgressScreen.tsx`:
   - Para cada ejercicio de la rutina del día
   - Input: peso utilizado, repeticiones completadas
   - Selector de esfuerzo percibido (1-10)
   - Notas opcionales (dolor, molestia, etc.)
2. `NewMeasurementScreen.tsx`:
   - Formulario de medición corporal completa
   - Opción de subir foto de progreso (cámara o galería)
3. Implementar upload de imágenes a Supabase Storage
4. Marcar ejercicios como completados en la rutina

🧪 **Validación:** Puedes completar tu rutina del día registrando el progreso de cada ejercicio.

---

### Semana 11: Gráficas y Visualización

🎯 **Objetivo:** Gráficas de evolución que muestren el progreso del usuario

📚 **Aprenderás:** Librerías de gráficas, transformación de datos

✅ **Tareas:**
1. Instalar: `npm install react-native-chart-kit react-native-svg`
2. `ProgressScreen.tsx`:
   - **Gráfica de peso corporal** a lo largo del tiempo (línea)
   - **Gráfica de medidas** (cintura, pecho, brazo) (línea múltiple)
   - **Gráfica por ejercicio** (peso levantado) (barras)
   - **Porcentaje de adherencia** (% de rutina completada) (donut)
3. `ProgressPhotoScreen.tsx`:
   - Galería de fotos con fechas
   - Comparación lado a lado (antes/después)
4. Implementar push notifications:
   ```bash
   npx expo install expo-notifications
   ```
   - Recordatorio diario para entrenar
   - Notificación cuando la IA genera nueva rutina
   - Alerta si la IA detecta algo importante

🧪 **Validación:** Después de 2+ semanas de datos, las gráficas muestran tendencias claras.

---

## 🔴 FASE 5 — Pulido y Deploy

### Semana 12: UI/UX y Testing

✅ **Tareas:**
1. Definir paleta de colores y tema consistente
2. Agregar animaciones sutiles (react-native-reanimated)
3. Implementar dark mode
4. Loading states y skeletons en todas las pantallas
5. Manejo de errores amigable (mensajes para el usuario)
6. Escribir tests unitarios para el backend (Jest)
7. Escribir tests de componentes para la app

---

### Semana 13: Optimización

✅ **Tareas:**
1. Optimizar llamadas a la API (debounce, cache)
2. Lazy loading de imágenes
3. Paginación en listados largos
4. Revisar y optimizar queries de Prisma
5. Agregar logs estructurados en el backend (winston)
6. Implementar health check endpoint

---

### Semana 14: Deploy

✅ **Tareas:**
1. Deploy backend en Railway:
   ```bash
   # Instalar Railway CLI
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
2. Configurar variables de entorno en Railway
3. Build de la app con EAS:
   ```bash
   npm install -g eas-cli
   eas login
   eas build --platform android
   # Opcional: eas build --platform ios
   ```
4. Probar APK en dispositivo físico
5. Crear README.md del repositorio
6. Escribir guía rápida de uso

🧪 **Validación final:** La app funciona completamente en un celular real, conectada al backend en la nube.

---

## 📊 Resumen del Timeline

| Semana | Fase | Entregable |
|--------|------|-----------|
| 1 | Backend | Proyecto + BD configurados |
| 2 | Backend | Login/Register con JWT |
| 3 | Backend | CRUD usuarios + mediciones |
| 4 | IA | Generador de rutinas con IA |
| 5 | IA | Chat + Nutrición + Alertas |
| 6 | Mobile | App con login funcional |
| 7 | Mobile | Perfil + Rutinas |
| 8 | Mobile | Nutrición + Chat IA |
| 9 | Mobile | Panel de Admin |
| 10 | Progreso | Registro de ejercicios |
| 11 | Progreso | Gráficas + Notificaciones |
| 12 | Deploy | UI/UX + Testing |
| 13 | Deploy | Optimización |
| 14 | Deploy | Deploy final |

**Tiempo total estimado:** 14 semanas (~3.5 meses)  
**Dedicación sugerida:** 8-15 horas por semana

---

## 🚀 Extensiones Futuras (Post-MVP)

Una vez tengas el MVP funcionando, podrías agregar:

- **Multi-gimnasio (SaaS):** Cada gym tiene su cuenta, cobrar suscripción mensual
- **Wearables:** Integrar con Apple Watch, Fitbit, Google Fit
- **Video de ejercicios:** Base de datos de videos demostrativos
- **Comunidad:** Rankings, challenges entre miembros
- **Pagos:** Integrar Stripe para membresías online
- **Versión Web:** Dashboard para el admin en navegador
- **Modelo propio de IA:** Fine-tune de un modelo open source con datos reales

---

*Roadmap Tecnico - Tuco*  
*Marzo 2026*
