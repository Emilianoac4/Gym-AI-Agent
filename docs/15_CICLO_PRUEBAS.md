# GymAI – Ciclo de Pruebas Pendientes

**Versión**: 1.0  
**Fecha**: Abril 4, 2026  
**Git base**: `aee0acc` (HEAD)

Cada bloque agrupa pruebas por área funcional con prerequisito de ambiente,
pasos exactos y resultado esperado vs. resultado fallido.

---

## 0. Prerequisitos de ambiente

Antes de ejecutar cualquier prueba:

| Ítem | Acción |
|------|--------|
| Backend corriendo | `cd backend && npm run dev` → API en `http://localhost:3000` |
| SQL ejecutada en Supabase | Ejecutar `backend/prisma/add_assistance_request_type.sql` |
| App móvil corriendo | `cd mobile && npx expo start` |
| Platform portal | Abrir `platform-portal/platform-portal/index.html` en navegador con backend activo |

> ⚠️ La migración SQL es **bloqueante** para las pruebas del Bloque 3. Sin ella el campo `type` no existe en la tabla y la creación de solicitudes fallará.

---

## Bloque 1 — Teclado (KeyboardAvoidingView)

Verificar que en ninguna pantalla el teclado tape los inputs al editarlos.

### 1.1 Login — Android (o Android sim)
**Prerequisito**: Abrir app en dispositivo/emulador Android  
**Pasos**:
1. Navegar a pantalla de Login
2. Tocar el campo de email
3. Tocar el campo de contraseña

**Esperado**: El formulario sube y los campos quedan visibles sobre el teclado  
**Fallido antes**: El campo quedaba tapado (behavior era `undefined` en Android)

---

### 1.2 Register — Android
**Prerequisito**: Misma app, ir a pantalla de Registro  
**Pasos**:
1. Tocar cualquier campo del formulario

**Esperado**: Formulario sube sobre el teclado  
**Fallido antes**: Mismo problema que Login en Android

---

### 1.3 MeasurementsScreen — cualquier plataforma
**Pasos**:
1. Login como **member**
2. Ir a la pantalla de Medidas
3. Tocar el campo de "Peso" u otro campo numérico

**Esperado**: El ScrollView sube, el campo queda visible  
**Fallido antes**: No había KeyboardAvoidingView; el teclado tapaba los inputs

---

### 1.4 AssistanceScreen — modal de nueva solicitud
**Pasos**:
1. Login como **member**
2. Ir a la pantalla de Asistencia
3. Tocar "Nueva solicitud" (o equivalente para abrir el modal)
4. Tocar el área de texto de descripción

**Esperado**: El modal sube y el textarea queda visible sobre el teclado  
**Fallido antes**: KAV anidado dentro de View; el teclado tapaba el textarea del modal

---

### 1.5 AdminProfileScreen — modal "Enviar reporte"
**Pasos**:
1. Login como **admin**
2. Ir a Perfil de administrador
3. Tocar el botón de enviar reporte
4. Tocar el campo de email en el modal

**Esperado**: El campo de email queda visible con el teclado abierto  
**Fallido antes**: Modal sin KAV; el email quedaba tapado

---

## Bloque 2 — Platform Portal (P3)

Pruebas de las dos funciones nuevas del portal de plataforma: lock de gym y gestión de admins.

### 2.1 Bloquear (lock) un gimnasio
**Prerequisito**: Tener al menos un gym activo creado en el sistema  
**Pasos**:
1. Abrir platform portal → autenticarse
2. Localizar un gym activo en la lista
3. Pulsar el botón **Bloquear** en la tarjeta del gym
4. Confirmar el lock con el motivo solicitado

**Esperado**:
- El gym aparece marcado como bloqueado en el portal
- Si un admin/member de ese gym intenta hacer login → recibe error `gym_locked` (403)

---

### 2.2 Desbloquear (unlock) un gimnasio
**Pasos** (continuación del 2.1):
1. Localizar el gym bloqueado
2. Pulsar **Desbloquear**

**Esperado**: El gym vuelve a estado activo; el admin del gym puede volver a autenticarse

---

### 2.3 Desactivar admin de gimnasio
**Prerequisito**: Gym con al menos un admin registrado  
**Pasos**:
1. Ir a los detalles del gym (`/companies/:gymId`)
2. Localizar un admin en la lista de admins
3. Pulsar **Desactivar admin**

**Esperado**:
- El admin aparece desactivado en el portal
- Ese admin no puede autenticarse en la app móvil (401 / acceso denegado)

---

### 2.4 Eliminar admin de gimnasio (soft delete)
**Pasos**:
1. Mismo contexto que 2.3
2. Pulsar **Eliminar admin** (con confirmación de motivo si aplica)

**Esperado**:
- El admin desaparece de la lista activa
- Aparece en la sección de "Eliminados" si el portal los muestra
- No puede autenticarse en la app

---

## Bloque 3 — AssistanceScreen: campo `type`

Estas pruebas requieren que la migración SQL `add_assistance_request_type.sql` esté aplicada.

### 3.1 Crear solicitud SIN tipo seleccionado
**Pasos**:
1. Login como **member**
2. Ir a Asistencia → Nueva solicitud
3. Escribir descripción (sin tocar el selector de tipo)
4. Enviar

**Esperado**:
- Solicitud creada con `type: null`
- La tarjeta en el historial NO muestra pill de tipo

---

### 3.2 Crear solicitud CON tipo seleccionado
**Pasos**:
1. Login como **member**
2. Ir a Asistencia → Nueva solicitud
3. Tocar **"Desplegar menú de alertas"**
4. Seleccionar una de las opciones: Acoso / Incidente / Accidente / Lesión
5. Verificar que el botón de trigger cambia su texto al tipo elegido (chevron cambia dirección)
6. Escribir descripción y enviar

**Esperado**:
- Solicitud creada con el `type` correcto en BD
- La tarjeta del historial muestra un pill con el tipo en español (ej. "Acoso")

---

### 3.3 Ciclo completo Acoso → Incidente → Accidente → Lesión
**Pasos**: Repetir 3.2 para cada uno de los 4 tipos  
**Esperado**: Cada tipo se guarda y muestra correctamente en la tarjeta

---

### 3.4 Selector colapsable: abrir y cerrar
**Pasos**:
1. Abrir modal de nueva solicitud
2. Tocar "Desplegar menú de alertas" → menú se expande (chevron ▲)
3. Tocar en cualquier lugar del dimmer (fuera de la tarjeta del modal) → modal se cierra
4. Volver a abrir modal
5. Tocar trigger → seleccionar un tipo → tocar trigger de nuevo

**Esperado**: El menú se abre y se cierra de forma fluida; la selección persiste mientras el modal está abierto; se resetea al cerrar el modal

---

### 3.5 Validación backend: tipo inválido
**Requisito**: acceso a HTTP client (curl, Postman, etc.)
**Pasos**:
```http
POST /assistance
Authorization: Bearer <member_token>
Content-Type: application/json

{ "description": "test", "type": "invalido" }
```
**Esperado**: `400 Bad Request` con error de validación Zod para el campo `type`

---

## Bloque 4 — Flujo completo de Asistencia (workflow)

Prueba de extremo a extremo del ciclo de vida de una solicitud.

### 4.1 Flujo member → trainer → calificación
**Actores necesarios**: 1 cuenta member, 1 cuenta trainer, 1 cuenta admin

| Paso | Actor | Acción | Esperado |
|------|-------|--------|----------|
| 1 | Member | Crea solicitud (con tipo "Incidente") | Estado `CREATED` |
| 2 | Trainer | Abre `AssistanceRequestsScreen` → ve la solicitud | Aparece en bandeja |
| 3 | Trainer | Toca "Asignarme" | Estado `ASSIGNED` |
| 4 | Trainer | Toca "Resolver" + escribe nota de resolución | Estado `RESOLVED` |
| 5 | Member | Abre su historial de solicitudes | Ve la solicitud como resuelta |
| 6 | Member | Califica la atención (1-5 estrellas) | Estado `RATED`, rating guardado |
| 7 | Admin | Abre `AdminProfileScreen` → sección de calificaciones | Ve la calificación del paso 6 |

---

## Bloque 5 — Navegacion y roles

Verificar que cada rol solo ve las pantallas que le corresponden.

### 5.1 Member: pantallas accesibles
Login como member → confirmar que el tab bar SOLO muestra:
- Home
- Chat IA
- Rutina
- Medidas
- Asistencia
- Perfil

NO debe ver: AdminProfileScreen, AdminUsersScreen, TrainerProfileScreen, AssistanceRequestsScreen (bandeja de trainer)

---

### 5.2 Trainer: pantallas accesibles
Login como trainer → confirmar:
- Tiene acceso a `TrainerProfileScreen` (toggle presencia activo/inactivo)
- Tiene acceso a `AssistanceRequestsScreen` (bandeja)
- NO tiene acceso a `AdminProfileScreen` ni `AdminUsersScreen`

---

### 5.3 Admin: pantallas accesibles
Login como admin → confirmar:
- Tiene acceso a `AdminProfileScreen` (KPIs, reporte mensualidades, presencia trainers, riesgo abandono)
- Tiene acceso a `AdminUsersScreen` (lista usuarios del gym, botón desactivar)
- Tiene acceso a `AdminMessagesScreen`
- NO tiene acceso al platform portal desde la app móvil (es herramienta separada)

---

## Bloque 6 — Regresión: funcionalidades pre-existentes

Verificar que los cambios del commit `aee0acc` no rompieron funcionalidad anterior.

| ID | Pantalla | Acción | Esperado |
|----|----------|--------|----------|
| 6.1 | LoginScreen | Login con credenciales válidas | Acceso correcto sin loops |
| 6.2 | RegisterScreen | Registro de nuevo usuario | Cuenta creada, login exitoso |
| 6.3 | ChatScreen | Enviar mensaje al chat IA | Respuesta en ≤ 10 s, sin markdown en texto |
| 6.4 | MeasurementsScreen | Guardar nueva medición | Medición persistida, aparece en historial |
| 6.5 | ProfileScreen | Editar nombre + goal + guardar | Cambios guardados, se ven al reabrir |
| 6.6 | RoutineScreen | Ver rutina generada por IA | Rutina carga correctamente |
| 6.7 | MessagesConversationScreen | Enviar mensaje directo | Mensaje aparece en conversación |
| 6.8 | TrainerProfileScreen | Toggle presencia activo/inactivo | Estado cambia y persiste |
| 6.9 | AdminProfileScreen | Ver KPIs del panel | KPIs cargan (totalMembers, active hoy, etc.) |
| 6.10 | ActiveTrainersScreen | Ver trainers activos (como member) | Lista carga sin error |

---

## Bloque 7 — Migración SQL pendiente (prerequisito de prod)

> Estas acciones NO son pruebas funcionales de UI, son tareas de infra que deben hacerse antes de deploy.

| # | Archivo | Acción | Verificación |
|---|---------|--------|--------------|
| 7.1 | `add_assistance_request_type.sql` | ✅ **YA EJECUTADO** (Abril 4, 2026) | Columna `type VARCHAR(50) NULL` presente en `public.assistance_requests` |

---

## Resumen rápido por sesión de pruebas

Si se prueba en una sola sesión sugerida:

1. **Aplicar SQL** (Bloque 7.1) → 2 min
2. **Pruebas de teclado** (Bloques 1.1–1.5) → 10 min
3. **Pruebas de AssistanceScreen type** (Bloque 3) → 10 min
4. **Flujo completo asistencia** (Bloque 4.1) → 10 min
5. **Platform Portal P3** (Bloque 2) → 10 min
6. **Regresión rápida** (Bloque 6, los más críticos: 6.1, 6.3, 6.4, 6.9) → 10 min

Total estimado: ~50 min con las 3 cuentas (member, trainer, admin) y el portal activos.
