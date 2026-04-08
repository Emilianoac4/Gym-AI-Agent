# GymAI - Checklist de Seguridad Alta y Plan de Implementacion

**Version**: 1.0  
**Fecha**: Abril 8, 2026  
**Estado**: Activo y transversal al piloto  
**Objetivo**: elevar GymAI/Tuco a un nivel de seguridad alto y operativo para una aplicacion multi-tenant de fitness, salud, IA e imagenes.

---

## 1) Principios rectores

- Seguridad por capas: mobile, API, base de datos, storage, IA y operacion.
- Multi-tenant estricto: ningun dato puede cruzarse entre gimnasios.
- Minimo privilegio: cada actor, servicio y job solo accede a lo indispensable.
- Datos sensibles primero: salud, imagenes, pagos y auditoria tienen controles reforzados.
- Seguridad observable: todo control critico debe poder auditarse, probarse y monitorearse.

---

## 2) Checklist priorizada

### Critico - obligatorio antes de abrir piloto o ampliar superficie sensible

| ID | Control | Estado actual | Accion requerida | Evidencia esperada |
|---|---|---|---|---|
| C1 | TLS en todos los entornos publicados, sin HTTP inseguro expuesto | Parcial | Forzar HTTPS en frontend, API y callbacks externos | Verificacion de dominio, redirecciones y headers |
| C2 | Aislamiento multi-tenant real en backend y BD | Implementado/parcial | Mantener validaciones `gym_id` en backend, RLS y pruebas negativas entre tenants | Tests automatizados de no-fuga |
| C3 | Autenticacion robusta con expiracion corta y rotacion de refresh tokens | Parcial | Revisar vida util de access token, rotacion, revocacion y cierre remoto de sesiones | Matriz de tokens y pruebas de revocacion |
| C4 | Hash de contrasenas resistente a ataque offline | Implementado/parcial | Mantener `bcrypt` con costo vigente o migrar a `Argon2id` en fase posterior | Politica documentada + benchmark |
| C5 | Secretos fuera del repo, rotables y segmentados por entorno | Parcial | Inventario de secretos, rotacion trimestral y almacenamiento seguro | Runbook de rotacion |
| C6 | Validacion estricta de entrada y errores seguros | Implementado/parcial | Mantener Zod/validacion y asegurar que nunca se filtre stack al cliente | Tests de payload invalido |
| C7 | Rate limiting y proteccion anti abuso en auth, IA y recovery | Implementado/parcial | Ajustar limites por IP, usuario, tenant y ruta; agregar alertas por abuso | Reporte operativo 7d |
| C8 | Auditoria de eventos sensibles y seguridad runtime | Implementado/parcial | Completar cobertura para auth, admin, billing, IA y storage | `audit_logs` + dashboards |
| C9 | Politica de acceso a datos sensibles de salud e imagenes | Parcial | Formalizar permisos, consentimiento, retencion y eliminacion | Politica aprobada y trazabilidad |
| C10 | Backups cifrados y prueba real de restauracion | Pendiente | Definir RPO/RTO y ejecutar simulacro de restore | Acta de restore exitosa |
| C11 | Hardening de storage para fotos y archivos | Pendiente | URLs firmadas, expiracion corta, controles por rol y escaneo de contenido | Prueba de acceso denegado |
| C12 | Observabilidad y respuesta a incidentes | Parcial | Alertas para 401/403/429/500, runbooks y canal operativo | Dashboard y playbook |

### Alto - requerido para operacion madura del piloto

| ID | Control | Estado actual | Accion requerida | Evidencia esperada |
|---|---|---|---|---|
| A1 | MFA para admins de gimnasio y master admin | Pendiente | Implementar TOTP como minimo para roles privilegiados | Login MFA probado |
| A2 | Matriz RBAC por accion y recurso | Parcial | Completar permisos por endpoint, job y accion admin/trainer | Matriz viva y tests |
| A3 | Deteccion de enumeracion de usuarios y abuso de login | Parcial | Uniformar mensajes, throttling y alertas por patron | Reporte de eventos auth |
| A4 | Seguridad de sesion mobile | Parcial | Almacenar tokens en storage seguro y soportar logout/revocacion | Checklist mobile aprobada |
| A5 | Cifrado de datos especialmente sensibles fuera del simple reposo | Pendiente | Evaluar cifrado adicional de campos/archivos si contienen salud o imagenes criticas | Decision tecnica documentada |
| A6 | Politica de retencion por tipo de dato | Parcial | Definir ventanas para audit logs, imagenes, chat IA y consentimientos | Tabla de retencion aprobada |
| A7 | Escaneo de dependencias y vulnerabilidades en CI | Pendiente | Activar auditoria automatica de paquetes y reporte de CVEs | Pipeline de seguridad |
| A8 | Pruebas de autorizacion y regresion de seguridad | Parcial | Incorporar casos 401/403/tenant isolation en CI | Suite automatizada |
| A9 | Guardrails backend para IA | Parcial | Clasificacion de intencion, filtros de salida y bloqueo fuera de mision | Casos de prueba de guardrails |
| A10 | Proteccion de cargas multimedia | Pendiente | Limites de tamano, formato, cuota, moderacion y malware scanning | Flujo de upload validado |

### Medio - recomendado para endurecimiento continuo

| ID | Control | Estado actual | Accion requerida | Evidencia esperada |
|---|---|---|---|---|
| M1 | Device/session inventory por usuario | Pendiente | Mostrar sesiones activas y permitir cierre selectivo | UI/admin operativo |
| M2 | Security headers y CSP formales | Parcial | Revisar `HSTS`, `CSP`, `X-Content-Type-Options`, `Referrer-Policy` | Escaneo HTTP |
| M3 | Pinning o validacion reforzada en mobile para APIs sensibles | Pendiente | Evaluar certificate pinning segun costo operativo | Decision documentada |
| M4 | Tabletop exercises de incidente | Pendiente | Simular fuga, abuso de token y caida de proveedor IA | Informe postmortem |
| M5 | Clasificacion de datos y mapa de flujo | Pendiente | Inventariar donde viven salud, pagos, imagenes y prompts | Data map versionado |
| M6 | Programa de revision trimestral de permisos | Pendiente | Revisar roles, accesos de soporte y credenciales de servicio | Minuta trimestral |

---

## 3) Baseline actual resumido

### Fortalezas ya visibles

- RLS y endurecimiento de acceso en base de datos ya trabajados.
- Rate limiting ya integrado en backend para rutas sensibles.
- Telemetria de seguridad y `audit_logs` operativos para eventos runtime.
- Validacion de payloads y manejo de errores mas seguro que en iteraciones anteriores.
- Correccion reciente del flujo de login para evitar 500 no controlados por contrato legacy.

### Brechas principales actuales

- MFA ausente para roles privilegiados.
- Falta formalizar politicas de retencion, restore, secretos y storage de imagenes.
- Falta llevar pruebas de seguridad y dependencia a CI como requisito fijo.
- Falta endurecer mobile y archivos subidos al sistema.
- Falta cerrar guardrails backend de IA como politica transversal completa.

---

## 4) Plan de implementacion por fases

## Fase S0 - Cierre de base operativa (1 semana)

**Objetivo**: cerrar huecos que impactan autenticacion, sesiones, observabilidad y secreto operativo.

**Controles objetivo**: C3, C5, C6, C7, C8, C12, A3.

**Entregables**:

- Politica de tokens: expiracion, refresh rotation, revocacion y logout remoto.
- Inventario de secretos por entorno con plan de rotacion.
- Alertas operativas sobre `401`, `403`, `429`, `500` y picos por ruta.
- Pruebas automatizadas de login, refresh, revocacion y abuso de auth.

**Criterio de salida**:

- Ningun login invalido produce `500`.
- Todos los errores de auth quedan clasificados y auditados.
- Existe procedimiento de rotacion de secretos probado en staging.

## Fase S1 - Datos sensibles y archivos (1-2 semanas)

**Objetivo**: proteger salud, imagenes, consentimientos y almacenamiento.

**Controles objetivo**: C9, C10, C11, A5, A6, A10, M5.

**Entregables**:

- Matriz de datos sensibles por modulo.
- Politica de retencion para fotos, health sync, chat IA, auditoria y consentimientos.
- Flujos de upload con URLs firmadas, expiracion corta y permisos por rol.
- Moderacion/escaneo para imagenes y videos antes de publicacion.
- Simulacro de backup + restore documentado.

**Criterio de salida**:

- Ningun archivo sensible queda publico por URL permanente.
- Cada tipo de dato sensible tiene responsable, retencion y regla de borrado.
- Restore de BD validado con tiempo objetivo medido.

## Fase S2 - Identidad reforzada y permisos finos (1-2 semanas)

**Objetivo**: endurecer cuentas privilegiadas y permisos por accion.

**Controles objetivo**: A1, A2, A4, A8, M1, M6.

**Entregables**:

- MFA para `platform admin` y `gym admin`.
- Matriz de permisos por accion para admin, trainer, member y jobs.
- Suite de pruebas 401/403/tenant isolation en CI.
- Inventario de sesiones activas y cierre de sesion remoto.

**Criterio de salida**:

- Ningun rol privilegiado inicia sesion sin segundo factor.
- Cada endpoint critico tiene permiso explicito documentado y testeado.

## Fase S3 - Seguridad de IA y supply chain (1 semana)

**Objetivo**: cerrar riesgo especifico del producto por IA, prompts y dependencias.

**Controles objetivo**: A7, A9, M2, M3, M4.

**Entregables**:

- Guardrails backend para IA por intencion, tema permitido y formato de salida.
- Escaneo de dependencias y vulnerabilidades en pipeline.
- Revision formal de headers HTTP/CSP del portal y superficies web.
- Decision tecnica sobre pinning mobile.
- Simulacro de incidente por abuso de IA o fuga de token.

**Criterio de salida**:

- El asistente IA queda limitado a la mision fitness/salud/gimnasio definida.
- El pipeline falla si aparece vulnerabilidad severa no aprobada.

---

## 5) Orden recomendado dentro del plan global

1. Ejecutar Fase S0 antes de abrir nuevas capacidades sensibles en auth, recovery o admin portal.
2. Ejecutar Fase S1 antes de liberar fotos de usuario, analisis visual o biblioteca multimedia amplia.
3. Ejecutar Fase S2 antes del onboarding de multiples gimnasios o crecimiento de trainers.
4. Ejecutar Fase S3 en paralelo a la siguiente fase de IA para no ampliar riesgo sin controles.

---

## 6) Criterios de gobierno y seguimiento

- Este checklist debe revisarse al menos una vez por sprint.
- Ningun item critico puede marcarse completo sin evidencia verificable.
- Las desviaciones aceptadas deben quedar registradas con riesgo, fecha y responsable.
- Seguridad no se cierra por implementacion; se cierra por control operativo validado.

---

## 7) Resumen ejecutivo

GymAI/Tuco ya avanzo en endurecimiento de base de datos, rate limiting y auditoria runtime. El siguiente salto de madurez no depende de agregar mas features primero, sino de cerrar identidad reforzada, secretos, storage sensible, restore, MFA, CI de seguridad y guardrails backend de IA. Este documento convierte ese trabajo en una secuencia ejecutable para integrarlo al plan oficial de necesidades.

Complemento operativo: el backlog ejecutable, la clasificacion con evidencia del repo y la bajada a sprints hasta piloto estan documentados en `docs/17_BACKLOG_SEGURIDAD_PILOTO.md`.