# GymAI - Plan de Implementacion de Funciones

**Version**: 1.0  
**Fecha**: Abril 1, 2026  
**Objetivo**: ejecutar de forma ordenada las funciones por rol (miembro y dueno), con foco en valor de negocio y calidad tecnica.

---

## 1) Estado Actual (baseline)

- IA operativa para: rutina, nutricion, chat y tip diario.
- Historial de chat persistido por usuario en `ai_chat_logs`.
- Mobile ya consume chat e historial.
- Roles actuales en backend: `member` y `admin`.

---

## 2) Principios de Ejecucion

- Construir por impacto: primero retencion y adherencia del miembro.
- No romper produccion: feature flags y migraciones pequenas.
- Medir todo: cada modulo nuevo debe emitir eventos clave.
- Seguridad por defecto: secretos fuera de repo, auditoria basica de acciones.

---

## 3) Roadmap por Fases

## Fase A (Semana 1): Hardening IA y Chat

**Objetivo**: mejorar calidad real del coach IA y su memoria conversacional.

### Backend
- Inyectar contexto de ultimos mensajes en `/ai/:userId/chat` (no solo guardar historial).
- Limitar ventana conversacional (ej. ultimos 10-20 mensajes) para controlar costo.
- Añadir resumen conversacional por usuario para memoria de largo plazo (tabla nueva opcional).
- Estandarizar guardrails de seguridad y respuestas fuera de alcance.

### Mobile
- Mostrar estado de sincronizacion de historial.
- Boton de "nueva conversacion" (separada de "borrar historial").
- Mensajes de error mas accionables (timeout, auth, servicio IA).

### Criterios de salida
- El chat responde usando contexto reciente verificable.
- P95 respuesta IA < 6s en entorno staging.
- Error rate IA < 2%.

## Fase B (Semana 2): Funciones Core para Miembro

**Objetivo**: elevar adherencia con progreso visible.

**Estado actual (Abril 1, 2026)**:
- Implementado: endpoint de resumen de progreso (`/users/:id/measurements/progress`) con cambios semanales/mensuales por metrica, racha semanal y sugerencia de siguiente accion.
- Implementado: consumo mobile en Home y Mediciones para mostrar progreso visible y check-in semanal.
- Pendiente para cerrar Fase B completa: progreso de cargas por ejercicio, persistencia de rutina semanal y alertas push programadas.

### Modulos
- Medicion corporal inteligente + carga manual asistida.
- Historial de progreso corporal y cargas (graficos y tendencias).
- Rutinas por objetivo con progreso semanal.
- Alertas basicas (recordatorio entreno y check-in semanal).

### Criterios de salida
- Miembro puede registrar y consultar su progreso en < 3 taps.
- Dash de progreso con comparacion semanal/mensual.

## Fase C (Semana 3): Funciones Core para Dueno/Admin

**Objetivo**: transformar datos en decisiones operativas.

### Modulos
- Picos de actividad por franja horaria.
- Maquinaria mas usada/atractiva.
- Deteccion temprana de riesgo de abandono (suscripcion activa + baja asistencia).
- Notificaciones de reactivacion tipo "duolingo".
- Satisfaccion del coach (NPS simple o rating por interaccion).

### Criterios de salida
- Admin ve KPIs accionables en un solo dashboard.
- Regla inicial de churn activa con lista de usuarios en riesgo.

## Fase D (Semana 4): Integraciones Biometricas + Operacion

**Objetivo**: habilitar automatizacion con datos reales del gimnasio.

### Modulos
- Ingesta de biometria (entradas/salidas) via API o archivo batch.
- Trazabilidad de asistencia miembros y colaboradores.
- Reportes exportables (CSV/PDF) para planilla y operacion.

### Criterios de salida
- Pipeline de biometria funcionando en staging.
- Reportes semanales automaticos para dueno.

---

## 4) Backlog Tecnico Priorizado

1. Chat con memoria contextual (lectura de historial + prompt builder).
2. Modelo de datos para eventos de negocio (asistencia, uso de maquina, notificaciones).
3. Dashboard admin con 4 KPIs iniciales (actividad, churn, satisfaccion, uso maquinaria).
4. Motor de notificaciones (scheduler + plantillas).
5. Seguimiento de progreso de miembro (medidas + cargas + rutina completada).

---

## 5) Riesgos y Mitigacion

- **Costo IA**: limitar tokens, cache de respuestas frecuentes, resumen de historial.
- **Calidad de datos**: validaciones server-side y jobs de limpieza.
- **Dependencia de terceros (biometria)**: adaptador desacoplado por proveedor.
- **Seguridad**: rotacion de API keys, secretos en Render y nunca en git.

---

## 6) Metricas de Exito

- Retencion semanal de miembros.
- % usuarios con >=2 sesiones/semana.
- Tiempo medio de respuesta del coach IA.
- Tasa de reactivacion de usuarios en riesgo.
- Satisfaccion promedio del coach.

---

## 7) Primer Sprint (72 horas)

1. Implementar memoria contextual del chat IA.
2. Definir contrato de eventos para dashboard admin.
3. Crear tablero minimo de progreso de miembro.
4. Instrumentar telemetria base (errores IA, latencia, uso por endpoint).

Este sprint deja una base funcional para continuar el resto de modulos por rol sin retrabajo.
