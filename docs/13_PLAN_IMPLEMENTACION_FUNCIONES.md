# GymAI - Plan Prioritario de Implementacion de Funciones

**Version**: 2.0  
**Fecha**: Abril 1, 2026  
**Estado**: PRIORIDAD TOTAL DE PRODUCTO Y DESARROLLO  
**Objetivo**: ejecutar la nueva perspectiva de 3 perfiles (administrador, entrenador, usuario) con base tecnica solida, trazabilidad y foco en retencion.

---

## 1) Prioridad Oficial

Este documento pasa a ser la referencia principal de ejecucion.

- Toda decision funcional nueva debe alinearse a este plan.
- Se prioriza construir cimientos (permisos, datos y auditoria) antes de crecer modulos.
- No se considera completa una funcion sin criterios de salida y metricas.

---

## 2) Nueva Vision de Roles

## Administrador (dueno del gimnasio)

- Ver entrenadores activos en tiempo real.
- Ver usuarios activos en tiempo real.
- Ver usuarios con suscripcion activa y vencimientos.
- Ver metricas de negocio (altas, renovaciones, ingresos, retencion).
- Gestionar usuarios (incluye eliminacion con auditoria).
- Recibir alertas de riesgo de abandono.

## Entrenador (colaborador)

- Registrar usuarios nuevos.
- Renovar suscripciones existentes.
- Registrar metodo de pago y monto por operacion.
- Marcar estado operativo (activo/no operativo).
- Recibir solicitudes de asistencia de usuarios.
- Ver rutinas que usuarios estan ejecutando en tiempo real.

## Usuario (cliente final)

- Chat IA personalizado.
- Rutinas personalizadas y seguimiento de progreso.
- Ver entrenadores operativos.
- Consultar dias restantes de suscripcion.
- Solicitar asistencia y calificar atencion (1-5 estrellas).
- Ver progreso calendarizado (minimo 3 meses).

---

## 3) Aspectos Criticos a Implementar Antes de Escalar Funciones

Estas reglas son obligatorias antes de abrir modulos nuevos:

1. Matriz de permisos por accion (no solo por rol).
2. Modelo de datos separado para suscripcion, pago, asistencia y acceso.
3. Estados estandar para asistencia a entrenador:
	 - `CREATED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `RATED`.
4. Estados operativos estandar para entrenador:
	 - `ACTIVE`, `PAUSED`, `OFFLINE`.
5. Auditoria de acciones sensibles:
	 - altas, renovaciones, eliminaciones, cambios de cobro.
6. Politica de privacidad para datos sensibles:
	 - salud, biometria, asistencia, pagos.
7. Definicion unica de "usuario activo hoy":
	 - por acceso biometrico, check-in manual o ambos (regla documentada).

---

## 4) Estado Actual (baseline tecnico)

- IA operativa para rutina, nutricion, chat y tip.
- Memoria conversacional en chat implementada.
- Progreso de rutina y cargas implementado para usuario.
- Roles activos hoy: `member` y `admin`.

Brecha principal:

- Falta introducir rol `trainer` y permisos granulares por accion.
- Falta capa operativa (suscripciones, cobros, asistencia, actividad en tiempo real).

---

## 5) Roadmap Priorizado por Fases

## Fase 0 (bloqueante): Fundacion de Roles, Permisos y Datos

**Objetivo**: evitar retrabajo y asegurar control operativo.

### Entregables

- Nuevo rol `trainer` en dominio y auth.
- Matriz de permisos por endpoint/accion.
- Entidades base:
	- `subscriptions`
	- `payments`
	- `trainer_presence`
	- `assistance_requests`
	- `access_events`
	- `audit_logs`
- Contrato de eventos para dashboard (eventos diarios agregables).

### Criterios de salida

- Ningun endpoint sensible funciona sin permiso correcto.
- Toda operacion de alta/renovacion/eliminacion queda auditada.

## Fase 1: Operacion de Entrenador

**Objetivo**: habilitar trabajo diario de colaboradores.

### Entregables

- Alta de usuario por entrenador.
- Renovacion de usuario por entrenador.
- Registro de cobro por operacion (monto + metodo).
- Boton de estado operativo entrenador.
- Bandeja de solicitudes de asistencia.

### Criterios de salida

- Cada alta/renovacion crea transaccion y auditoria.
- Entrenador puede aceptar y cerrar asistencia desde mobile.

## Fase 2: Panel Administrador MVP

**Objetivo**: visibilidad de negocio y operacion en tiempo real.

### Entregables

- KPI en vivo:
	- entrenadores activos
	- usuarios activos
	- usuarios con mensualidad activa
- KPI diarios:
	- nuevos usuarios
	- renovaciones
	- ingresos
- Reporte de riesgo de abandono (>=6 dias sin asistencia).

### Criterios de salida

- Dashboard usable en mobile y desktop.
- Datos consistentes con transacciones reales del sistema.

## Fase 3: Usuario Avanzado

**Objetivo**: experiencia personalizada y retencion.

### Entregables

- Solicitud de asistencia desde usuario.
- Calificacion de atencion (1-5 estrellas).
- Progreso calendarizado 3 meses.
- Consulta de dias restantes de suscripcion.

### Criterios de salida

- Usuario puede ver progreso y estado de suscripcion sin friccion.
- Calificaciones impactan metricas de entrenador/admin.

## Fase 4: Integraciones Externas

**Objetivo**: cerrar circuito de datos reales del gimnasio.

### Entregables

- Integracion con sistema biometrico de acceso.
- Integracion salud (Apple Health y Google ecosystem).
- Pipeline de eventos para reportes y alertas.

### Criterios de salida

- Registro de accesos en tiempo real por usuario.
- Datos de salud sincronizados de forma controlada y auditable.

---

## 6) Backlog Tecnico Priorizado (Top 12)

1. Introducir rol `trainer` en auth, schema y mobile session.
2. Crear matriz permisos por accion y middleware centralizado.
3. Crear entidades `subscriptions` y `payments`.
4. Crear endpoints de alta/renovacion por entrenador.
5. Crear `trainer_presence` con estado operativo.
6. Crear `assistance_requests` con workflow completo.
7. Crear `audit_logs` para acciones sensibles.
8. Crear agregaciones diarias para panel admin.
9. Exponer KPI de actividad y churn inicial.
10. Exponer consulta de suscripcion para usuario.
11. Exponer calendario de progreso de 3 meses.
12. Preparar adaptador de integracion biometrica.

---

## 7) Riesgos y Mitigacion

- Riesgo de permisos insuficientes:
	- Mitigacion: matriz de permisos y tests de autorizacion por rol.
- Riesgo de inconsistencias en pagos/suscripciones:
	- Mitigacion: transacciones atomicas y auditoria obligatoria.
- Riesgo de privacidad de datos sensibles:
	- Mitigacion: minimizacion de datos, cifrado y trazabilidad de acceso.
- Riesgo de dependencia de terceros (biometria/salud):
	- Mitigacion: capa adaptadora por proveedor.

---

## 8) Metricas de Exito (producto + operacion)

- Retencion semanal de usuarios.
- % usuarios con 2+ sesiones por semana.
- Tiempo medio de respuesta de asistencia entrenador.
- % solicitudes de asistencia resueltas.
- Ingresos diarios y renovaciones diarias.
- Usuarios en riesgo de abandono.
- Satisfaccion media de atencion de entrenador.

---

## 9) Plan de Ejecucion Inmediata (sprints)

## Sprint 1 (72 horas)

1. Rol `trainer` + matriz de permisos por accion.
2. Entidades `subscriptions`, `payments`, `audit_logs`.
3. Endpoints de alta y renovacion por entrenador.

## Sprint 2

1. Estado operativo de entrenadores.
2. Solicitudes de asistencia con ciclo completo.
3. KPI admin en vivo (activos y mensualidades activas).

## Sprint 3

1. KPI historicos (altas, renovaciones, ingresos).
2. Alerta de riesgo de abandono.
3. Consulta de suscripcion y progreso calendarizado en perfil usuario.

---

## 10) Regla de Prioridad

Este plan tiene prioridad sobre propuestas anteriores mientras no se emita una version superior.
