# GymAI - Plan de Implementacion de Disponibilidad Horaria

**Version**: 1.0  
**Fecha**: Abril 2, 2026  
**Estado**: aprobado para ejecucion  
**Objetivo**: permitir que miembros vean la disponibilidad horaria del gimnasio y que administradores o entrenadores autorizados la gestionen con horario estandar y excepciones por dia.

---

## 1. Por que esta funcion entra ahora

Esta capacidad encaja con la vision operativa del producto y llena un hueco claro entre:

- la experiencia del miembro en la pantalla principal,
- la operacion diaria del gimnasio,
- y la futura capa de asistencia, presencia y metricas.

No debe construirse como calendario complejo ni como sistema de reservas en esta fase. La primera entrega debe resolver una sola cosa bien: **mostrar y administrar la disponibilidad operativa del gimnasio por franjas horarias**.

---

## 2. Alcance funcional de la primera version

### Miembro

- Ver en Inicio la disponibilidad del dia.
- Ver un resumen de los proximos 7 dias.
- Entender si una franja esta disponible, limitada o cerrada.

### Administrador

- Configurar horario estandar semanal del gimnasio.
- Editar excepciones por fecha especifica.
- Definir franjas no disponibles por cierre parcial, evento o feriado.
- Ver quien hizo el ultimo cambio.

### Entrenador autorizado

- Puede editar disponibilidad solo si tiene permiso explicito.

### Fuera de alcance en esta version

- Reservas de cupos por usuario.
- Pago de clases o bloques horarios.
- Sincronizacion con biometrico o aforo real.
- Reglas avanzadas de sobrecupo.

---

## 3. Regla de producto

La disponibilidad representa la **capacidad operativa declarada del gimnasio**, no la ocupacion real en vivo.

Esto evita mezclar desde ahora:

- horario de apertura,
- aforo real,
- asistencia real,
- y reservas.

La app primero mostrara lo que el gimnasio dice que esta disponible. Mas adelante se puede enriquecer con presencia real o acceso biometrico.

---

## 4. Modelo de datos recomendado

La implementacion correcta para v1 necesita dos niveles: plantilla semanal y excepciones por fecha.

### 4.1 Plantilla semanal

Tabla sugerida: `gym_schedule_templates`

Campos propuestos:

- `id`
- `gym_id`
- `day_of_week` (`monday` ... `sunday`)
- `is_open`
- `opens_at` (`HH:mm`)
- `closes_at` (`HH:mm`)
- `slot_minutes` (ej. `60`)
- `capacity_label` opcional (`alta`, `media`, `baja` o texto libre corto)
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

Restriccion:

- unico por `gym_id + day_of_week`

### 4.2 Excepciones por fecha

Tabla sugerida: `gym_schedule_exceptions`

Campos propuestos:

- `id`
- `gym_id`
- `date`
- `is_closed`
- `opens_at` nullable
- `closes_at` nullable
- `slot_minutes` nullable
- `capacity_label` nullable
- `note` nullable
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

Restriccion:

- unico por `gym_id + date`

### 4.3 Permisos granulares

Como ya existe `trainer` y el producto pide que **solo algunos entrenadores** puedan editar disponibilidad, no alcanza con RBAC puro por rol.

La opcion mas limpia es agregar una tabla de grants por usuario.

Tabla sugerida: `user_permission_grants`

Campos propuestos:

- `id`
- `user_id`
- `permission_action`
- `granted_by_user_id`
- `created_at`

Restriccion:

- unico por `user_id + permission_action`

Permisos nuevos:

- `availability.read`
- `availability.write`
- `permissions.grant`

Regla recomendada:

- `admin`: tiene `availability.read`, `availability.write`, `permissions.grant`
- `trainer`: tiene `availability.read` y solo obtiene `availability.write` si tiene grant
- `member`: tiene `availability.read`

---

## 5. Prisma propuesto

### Enums nuevos

```prisma
enum DayOfWeek {
  monday
  tuesday
  wednesday
  thursday
  friday
  saturday
  sunday
}

enum PermissionGrantAction {
  availability_write
}
```

### Modelos nuevos

```prisma
model GymScheduleTemplate {
  id              String    @id @default(uuid())
  gymId           String    @map("gym_id")
  dayOfWeek       DayOfWeek @map("day_of_week")
  isOpen          Boolean   @default(true) @map("is_open")
  opensAt         String?   @map("opens_at")
  closesAt        String?   @map("closes_at")
  slotMinutes     Int       @default(60) @map("slot_minutes")
  capacityLabel   String?   @map("capacity_label")
  createdByUserId String    @map("created_by_user_id")
  updatedByUserId String    @map("updated_by_user_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@unique([gymId, dayOfWeek])
  @@map("gym_schedule_templates")
}

model GymScheduleException {
  id              String   @id @default(uuid())
  gymId           String   @map("gym_id")
  date            DateTime @map("date")
  isClosed        Boolean  @default(false) @map("is_closed")
  opensAt         String?  @map("opens_at")
  closesAt        String?  @map("closes_at")
  slotMinutes     Int?     @map("slot_minutes")
  capacityLabel   String?  @map("capacity_label")
  note            String?
  createdByUserId String   @map("created_by_user_id")
  updatedByUserId String   @map("updated_by_user_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@unique([gymId, date])
  @@map("gym_schedule_exceptions")
}

model UserPermissionGrant {
  id              String                @id @default(uuid())
  userId          String                @map("user_id")
  permissionAction PermissionGrantAction @map("permission_action")
  grantedByUserId String                @map("granted_by_user_id")
  createdAt       DateTime              @default(now()) @map("created_at")

  @@unique([userId, permissionAction])
  @@map("user_permission_grants")
}
```

---

## 6. API backend recomendada

Crear modulo nuevo: `backend/src/modules/availability`

Archivos esperados:

- `availability.routes.ts`
- `availability.controller.ts`
- `availability.service.ts`
- `availability.validation.ts`

### Endpoints de lectura

- `GET /availability/today`
  - devuelve disponibilidad del dia del gimnasio del usuario autenticado
- `GET /availability/next-7-days`
  - devuelve resumen de 7 dias
- `GET /availability/template`
  - devuelve plantilla semanal completa
- `GET /availability/exceptions?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - devuelve excepciones del rango

### Endpoints de escritura

- `PUT /availability/template/:dayOfWeek`
  - actualiza un dia del horario estandar
- `PUT /availability/template`
  - actualiza la semana completa de una vez
- `PUT /availability/exceptions/:date`
  - crea o reemplaza excepcion por fecha
- `DELETE /availability/exceptions/:date`
  - elimina excepcion y vuelve al horario estandar
- `POST /availability/permissions/:userId/grant`
  - otorga `availability.write`
- `DELETE /availability/permissions/:userId/grant`
  - revoca `availability.write`

### Resolucion de disponibilidad

La respuesta final para cada fecha debe seguir esta prioridad:

1. Si existe excepcion para la fecha, manda la excepcion.
2. Si no existe excepcion, se usa la plantilla del dia de semana.
3. Si no existe plantilla, el dia se considera cerrado.

---

## 7. Contratos de respuesta recomendados

### Franja diaria para mobile

```json
{
  "date": "2026-04-02",
  "status": "open",
  "source": "exception",
  "note": "Horario reducido por evento interno",
  "slots": [
    {
      "label": "06:00 - 09:00",
      "availability": "high"
    },
    {
      "label": "09:00 - 12:00",
      "availability": "limited"
    },
    {
      "label": "12:00 - 14:00",
      "availability": "closed"
    }
  ],
  "updatedBy": {
    "userId": "...",
    "fullName": "..."
  },
  "updatedAt": "2026-04-02T14:20:00.000Z"
}
```

### Regla visual para v1

- `high` = disponible
- `limited` = disponibilidad reducida
- `closed` = no disponible

Esto es suficiente para la primera UX y evita modelar aforo numerico demasiado pronto.

---

## 8. Mobile recomendado

### 8.1 Home del miembro y del entrenador

Pantalla afectada: `mobile/src/screens/Main/HomeScreen.tsx`

Agregar dos bloques:

- tarjeta `Disponibilidad de hoy`
- boton `Ver proximos 7 dias`

Comportamiento:

- carga al abrir Home
- si no hay datos, mostrar `Sin horario publicado para hoy`
- si el dia esta cerrado, mostrar `Gimnasio cerrado hoy`

### 8.2 Pantalla nueva de detalle semanal

Pantalla nueva sugerida:

- `mobile/src/screens/Main/GymAvailabilityScreen.tsx`

Contenido:

- lista de 7 dias
- chips o bandas por franja
- nota del dia si existe excepcion

### 8.3 Pantalla nueva de gestion operativa

Pantalla nueva sugerida:

- `mobile/src/screens/Main/AvailabilityManagementScreen.tsx`

Secciones:

- `Horario estandar`
- `Editar dia especial`
- `Entrenadores autorizados`

### 8.4 Navegacion

Ubicacion recomendada:

- `admin`: dentro de la tab `Operacion`
- `trainer`: nueva entrada visible solo si tiene permiso de escritura o al menos lectura administrativa
- `member`: acceso solo desde Home hacia vista de 7 dias

---

## 9. Cambios puntuales en el codigo actual

### Backend

1. Extender `PermissionAction` en `backend/src/config/permissions.ts`.
2. Modificar `hasPermission` para combinar permisos por rol y grants persistidos.
3. Crear modulo `availability` y montarlo en `backend/src/app.ts`.
4. Añadir migracion SQL en `backend/prisma/`.
5. Exponer tipos DTO limpios para mobile.

### Mobile

1. Extender `mobile/src/types/api.ts` con tipos de disponibilidad.
2. Extender `mobile/src/services/api.ts` con endpoints de disponibilidad.
3. Actualizar `mobile/src/navigation/AppNavigator.tsx` para las nuevas pantallas.
4. Insertar resumen de disponibilidad en `mobile/src/screens/Main/HomeScreen.tsx`.
5. Crear pantalla de 7 dias y pantalla de gestion.

---

## 10. Orden de implementacion recomendado

### Fase A - Fundacion backend

Objetivo: dejar lista la capa de datos y permisos.

Entregables:

- tablas nuevas
- permisos nuevos
- grants por usuario
- endpoints de lectura y escritura
- tests de autorizacion

Salida correcta:

- admin puede editar
- trainer sin grant no puede editar
- trainer con grant si puede editar
- member solo puede leer

### Fase B - Lectura mobile

Objetivo: dar valor inmediato al miembro.

Entregables:

- tarjeta de disponibilidad de hoy en Home
- pantalla de proximos 7 dias
- estados vacios claros

Salida correcta:

- un miembro entiende el horario sin entrar a un modulo complejo

### Fase C - Gestion operativa mobile

Objetivo: habilitar operacion real.

Entregables:

- edicion de horario semanal
- edicion de excepciones por fecha
- grants de entrenadores autorizados

Salida correcta:

- el gimnasio puede publicar su horario y corregir dias especiales sin tocar BD manualmente

---

## 11. Riesgos y decisiones importantes

### Riesgo 1: modelar reservas demasiado pronto

Mitigacion:

- mantener esta feature en disponibilidad declarativa, no reservas

### Riesgo 2: permisos insuficientes

Mitigacion:

- no resolverlo con `role === trainer`
- agregar grant explicito para `availability.write`

### Riesgo 3: UX confusa para el miembro

Mitigacion:

- usar mensajes simples: `Disponible`, `Reducido`, `Cerrado`
- evitar tablas densas o calendario tecnico en Home

---

## 12. Que recomiendo implementar despues

Una vez terminada esta capacidad, el mejor siguiente paso no es otra pantalla aislada. Lo correcto es cerrar la base operativa del negocio.

### Prioridad siguiente recomendada

1. `subscriptions` + `payments`
2. `audit_logs`
3. `trainer_presence`
4. `assistance_requests`
5. dashboard admin con actividad y riesgo

### Razon

La disponibilidad horaria abre operacion visible. El siguiente salto de valor real es monetizacion, trazabilidad y estado operativo humano. Eso convierte GymAI en sistema operativo del gimnasio y no solo en app de entrenamiento.

---

## 13. Resumen para retomar esta conversacion

Si mas adelante necesitamos volver exactamente a este punto, este es el resumen corto:

> Estamos implementando la capacidad de disponibilidad horaria del gimnasio. El miembro debe ver la disponibilidad de hoy en Home y poder consultar los proximos 7 dias. Admin y solo entrenadores autorizados pueden configurar un horario estandar semanal y editar excepciones por fecha. La implementacion correcta requiere dos tablas de horario (`template` y `exceptions`) y permisos por accion, porque no todos los trainers pueden editar. Esta feature no incluye reservas; solo representa disponibilidad operativa declarada. Cuando esta capacidad quede lista, la prioridad siguiente recomendada es `subscriptions`, `payments`, `audit_logs`, `trainer_presence` y luego `assistance_requests`.

---

## 14. Checklist ejecutable

1. Agregar modelos Prisma y migracion SQL.
2. Agregar permisos `availability.read`, `availability.write`, `permissions.grant`.
3. Crear grants por usuario para entrenadores autorizados.
4. Crear modulo backend `availability`.
5. Crear endpoints de today, next-7-days, template y exceptions.
6. Extender tipos y cliente API mobile.
7. Mostrar tarjeta de disponibilidad en Home.
8. Crear pantalla de 7 dias.
9. Crear pantalla de gestion operativa.
10. Validar autorizacion por rol y grant.