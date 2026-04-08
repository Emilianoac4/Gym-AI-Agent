# GymAI - Backlog Tecnico de Seguridad para Piloto

**Version**: 1.0  
**Fecha**: Abril 8, 2026  
**Objetivo**: convertir la checklist de seguridad alta en trabajo ejecutable, con evidencia real del repo y calendario concreto hasta el piloto del 21 de abril de 2026.

---

## 1) Estado real por control con evidencia del repo

| Control | Estado real | Evidencia actual en repo | Brecha principal |
|---|---|---|---|
| C1 TLS/headers HTTP | **Parcial** | Backend usa CORS configurable en `backend/src/app.ts`; portal es HTML estatico sin CSP ni headers visibles en `platform-portal/index.html` | Falta endurecer headers web (`HSTS`, `CSP`, `Referrer-Policy`, etc.) y verificar forzado HTTPS extremo a extremo |
| C2 Aislamiento multi-tenant | **Implementado/parcial** | Scripts RLS y FORCE RLS en `backend/prisma/SECURITY_HARDENING_PHASE1.sql`, validaciones/reportes en `backend/prisma/SECURITY_OPERATIONAL_AUDIT_REPORT.sql` y `backend/prisma/RLS_VALIDATION_CHECKLIST.sql` | Falta mantener pruebas negativas automatizadas por tenant en CI |
| C3 Tokens y sesiones robustas | **Parcial** | JWT con expiracion corta en `backend/src/utils/jwt.ts`; validacion de `JWT_EXPIRES_IN` en `backend/src/config/env.ts` | No existen refresh tokens ni revocacion remota; `backend/src/modules/auth/auth.routes.ts` no expone endpoints de refresh/logout server-side |
| C4 Hash de contrasenas | **Implementado/parcial** | `bcryptjs` con 12 rounds en `backend/src/modules/auth/auth.controller.ts` y `backend/src/modules/users/users.controller.ts` | Aun no hay politica formal de migracion futura o benchmark de costo |
| C5 Secretos y rotacion | **Parcial con riesgo critico** | Validacion de secretos en `backend/src/config/env.ts` | Existe `backend/.env` en workspace con secretos cargados; falta sacar secretos del repo operativo y rotarlos |
| C6 Validacion de entrada y errores seguros | **Implementado/parcial** | Validacion por esquema en `backend/src/modules/auth/auth.routes.ts`; endurecimiento de errores en `backend/src/middleware/error.middleware.ts` | Falta cobertura automatizada mas amplia por endpoint critico |
| C7 Rate limiting y abuso | **Implementado/parcial** | Limitadores globales y por ruta en `backend/src/app.ts`; motor de limitacion en `backend/src/middleware/rate-limit.middleware.ts` | El almacenamiento es en memoria del proceso; falta estrategia distribuida y tuning por tenant/actor |
| C8 Auditoria de seguridad runtime | **Implementado/parcial** | Emision de eventos en `backend/src/middleware/security-audit.middleware.ts`; dashboards en `backend/prisma/SECURITY_OPERATIONAL_EVENTS_7D.sql` | Falta cobertura completa en billing/storage y alertas automáticas fuera de SQL manual |
| C9 Datos sensibles salud/imagenes | **Parcial** | Permisos y health integration en `mobile/app.json`, `mobile/src/services/health.service.ts`, `backend/src/modules/measurements/measurements.controller.ts` | Falta politica formal de consentimiento, retencion y acceso por tipo de dato |
| C10 Backup/restore | **Pendiente** | No hay evidencia operativa de restore probado en repo | Falta runbook, objetivo RPO/RTO y simulacro real |
| C11 Storage seguro para imagenes | **Pendiente/critico** | Avatar se recibe como `imageBase64` y se guarda como data URI en `backend/src/modules/users/users.controller.ts` | Falta storage firmado, expiracion, escaneo y separacion de archivos fuera de BD |
| C12 Observabilidad y respuesta | **Parcial** | Reportes operativos en `backend/prisma/SECURITY_OPERATIONAL_AUDIT_REPORT.sql` y `backend/prisma/SECURITY_OPERATIONAL_EVENTS_7D.sql` | Falta alertado automatizado, playbooks y circuito de respuesta |
| A1 MFA admins | **Pendiente** | No hay flujos MFA en auth backend ni portal | Falta TOTP para `gym admin` y `platform admin` |
| A2 RBAC por accion | **Parcial** | Matriz en `backend/src/config/permissions.ts`; middleware en `backend/src/middleware/authorize.middleware.ts` | Aun no cubre toda la superficie ni grants finos por flujo nuevo |
| A3 Enumeracion y abuso login | **Parcial** | Rate limit por login en `backend/src/app.ts`; respuestas de auth ya endurecidas | Faltan alertas por patrón, lockout adaptativo y telemetria de enumeracion |
| A4 Seguridad de sesion mobile | **Parcial con brecha relevante** | Token solo en estado React en `mobile/src/context/AuthContext.tsx` | No se usa `SecureStore` ni rehidratacion segura de sesion |
| A5 Cifrado adicional sensible | **Pendiente** | No hay evidencia de cifrado de campo/archivo adicional para salud o imagenes | Falta decision y capa de cifrado selectivo |
| A6 Retencion por tipo de dato | **Parcial** | Hay reglas sueltas en plan funcional, pero no enforcement tecnico transversal | Falta tabla oficial por dato + jobs de expiracion |
| A7 Escaneo de dependencias/CI | **Pendiente** | No existen workflows detectados en `.github/` | Falta pipeline de seguridad y CVE scanning |
| A8 Pruebas de autorizacion/seguridad | **Parcial** | Existen validaciones SQL/manuales y scripts operativos en `backend/prisma/*validation*.sql` | Falta suite automatizada en CI para `401/403/tenant isolation` |
| A9 Guardrails backend IA | **Parcial** | Prompt de mision y filtros regex en `backend/src/modules/ai/ai.service.ts` | Falta clasificador robusto, politica de salida y pruebas dedicadas |
| A10 Proteccion de multimedia | **Pendiente/parcial** | Solo guardas de tamaño y formato base64 en `backend/src/modules/users/users.controller.ts` | Falta escaneo, moderacion, storage seguro y cuotas por rol |
| M2 Headers/CSP | **Parcial** | Portal simple en `platform-portal/index.html`; backend sin `helmet` en `backend/src/app.ts` | Falta endurecimiento formal de headers |
| M3 Endurecimiento mobile API | **Pendiente** | No hay evidencia de pinning o estrategia equivalente | Falta decision tecnica |

---

## 2) Backlog tecnico ejecutable por area

### Backend

| Ticket | Prioridad | Resultado esperado | Dependencias |
|---|---|---|---|
| BE-SEC-01 | Critica | Implementar refresh tokens con rotacion, revocacion y endpoint de cierre de sesion | Decision de modelo de sesion |
| BE-SEC-02 | Critica | Rotar `JWT_SECRET` y `PLATFORM_JWT_SECRET`, sacar secretos operativos del repo y documentar runbook | Coordinacion con despliegue |
| BE-SEC-03 | Alta | Incorporar headers de seguridad (`helmet` o equivalente) y endurecer CORS | Reglas de portal/frontend |
| BE-SEC-04 | Alta | Añadir pruebas automáticas para `401`, `403`, `429`, aislamiento tenant y errores seguros | Base de test/staging |
| BE-SEC-05 | Alta | Reemplazar subida de avatar/base64 por flujo de upload seguro con URL firmada | Infra/storage |
| BE-SEC-06 | Alta | Formalizar retencion y expiracion tecnica para audit logs, fotos, health y prompts | Product + legal operativo |
| BE-SEC-07 | Media | Evaluar rate limiting distribuido o persistente si se escala a varias instancias | Infra |

### Mobile

| Ticket | Prioridad | Resultado esperado | Dependencias |
|---|---|---|---|
| MOB-SEC-01 | Critica | Mover token y selector token a `expo-secure-store` con restauracion controlada | Definicion BE-SEC-01 |
| MOB-SEC-02 | Alta | Manejar expiracion/revocacion de sesion y cierre limpio de credenciales locales | Refresh/logout backend |
| MOB-SEC-03 | Alta | Definir endurecimiento de fotos y health permissions en flujos sensibles | Nuevo flujo de storage |
| MOB-SEC-04 | Media | Evaluar pinning/cert validation reforzada y documentar decision | Infra |

### Infra / DevOps

| Ticket | Prioridad | Resultado esperado | Dependencias |
|---|---|---|---|
| INF-SEC-01 | Critica | Secretos centralizados por entorno y rotacion trimestral | Inventario de secretos |
| INF-SEC-02 | Critica | Simulacro de backup + restore con RPO/RTO documentado | Acceso a plataforma DB/storage |
| INF-SEC-03 | Alta | Pipeline de seguridad con audit de dependencias y falla por severidad alta | Definicion CI |
| INF-SEC-04 | Alta | Alertas operativas para picos `401/403/429/500` y errores criticos | Telemetria actual |

### Portal central

| Ticket | Prioridad | Resultado esperado | Dependencias |
|---|---|---|---|
| WEB-SEC-01 | Alta | Agregar CSP y headers de seguridad al portal central | Infra/hosting |
| WEB-SEC-02 | Alta | Implementar MFA para `platform admin` | Backend auth |
| WEB-SEC-03 | Media | Agregar timeout de inactividad y endurecimiento de sesion | Backend sesiones |

### IA / Politicas de producto

| Ticket | Prioridad | Resultado esperado | Dependencias |
|---|---|---|---|
| AI-SEC-01 | Alta | Clasificador backend de alcance y guardrails verificables por pruebas | Definicion de politica |
| AI-SEC-02 | Alta | Disclaimer y politica uniforme para consejos fitness no medicos | Product |
| AI-SEC-03 | Media | Registro operativo de rechazos fuera de mision y sus metricas | Telemetria `security_event` |

---

## 3) Sprints concretos hasta piloto

## Sprint S0-A - Contencion critica inmediata

**Fechas**: Abril 8 al Abril 10

**Objetivo**: eliminar los riesgos mas peligrosos antes de crecer superficie.

**Tickets**:

- BE-SEC-02
- INF-SEC-01
- BE-SEC-01 (diseno + contrato de API)
- MOB-SEC-01 (diseno tecnico)

**Salida exigida**:

- Secretos rotados y fuera del flujo normal del repo.
- Contrato aprobado para refresh/revoke/logout.
- Lista oficial de secretos por entorno y responsables.

## Sprint S0-B - Sesiones, headers y pruebas minimas

**Fechas**: Abril 11 al Abril 15

**Objetivo**: cerrar autenticacion operativa y endurecimiento web/mobile basico.

**Tickets**:

- BE-SEC-01
- MOB-SEC-01
- MOB-SEC-02
- BE-SEC-03
- BE-SEC-04
- WEB-SEC-01

**Salida exigida**:

- Refresh tokens funcionando con revocacion.
- Mobile almacenando sesion en storage seguro.
- Backend/portal con headers de seguridad minimos.
- Suite minima automatizada cubriendo `401/403/429` y tenant isolation critica.

## Sprint S0-C - Restore, uploads y alertado

**Fechas**: Abril 16 al Abril 20

**Objetivo**: cerrar datos sensibles y respuesta operativa antes del piloto.

**Tickets**:

- INF-SEC-02
- INF-SEC-04
- BE-SEC-05
- BE-SEC-06
- AI-SEC-01
- AI-SEC-02

**Salida exigida**:

- Simulacro de restore completado.
- Alertas operativas activas.
- Upload de avatar/foto fuera de base64 persistido en storage seguro.
- Guardrails IA backend documentados y probados.

---

## 4) Orden de ejecucion recomendado

1. No empezar MFA o grandes cambios de portal antes de cerrar secretos y sesiones.
2. No abrir fotos/analisis visual antes de reemplazar base64 por storage seguro.
3. No considerar seguridad alta del piloto cerrada sin restore probado y alertas activas.
4. No ampliar IA sensible antes de formalizar guardrails backend verificables.

---

## 5) Siguiente paso exacto del plan

El siguiente paso recomendado es iniciar **Sprint S0-A** con foco inmediato en **BE-SEC-02 + INF-SEC-01**: saneamiento y rotacion de secretos, porque hoy existe evidencia de configuracion sensible operativa en `backend/.env`, y ese riesgo es mas urgente que cualquier mejora posterior de MFA, uploads o portal. En paralelo debe definirse el contrato de refresh/revoke/logout (`BE-SEC-01`) para que mobile y portal no sigan creciendo sobre sesiones incompletas.

---

## 6) Resumen ejecutivo

La plataforma ya tiene una base mejor que un MVP comun en RLS, auditoria y rate limiting. El hueco mas importante para el piloto no es falta de features, sino higiene de secretos, sesiones reales, storage seguro para imagenes, restore probado y seguridad automatizada en CI/operacion. Este backlog convierte eso en trabajo secuenciado y ejecutable.

Runbook operativo asociado para INF-SEC-01: `docs/18_RUNBOOK_ROTACION_SECRETOS.md`.

---

## 7) Estado de avance actual (Sprint S0-A)

- `BE-SEC-01` implementado en backend: refresh token, rotacion y revocacion por logout.
- `MOB-SEC-01` implementado en mobile: sesion segura con `expo-secure-store` y rehidratacion por refresh.
- `BE-SEC-02` ejecutado en entorno local: secretos JWT/platform rotados en `backend/.env`.
- `INF-SEC-01` **CERRADO** (2026-04-08): smoke staging PASS=7 FAIL=0, portal headers PASS, produccion N/A (entorno unico en piloto). Ver `docs/19_CIERRE_INF_SEC_01.md`.
- `BE-SEC-03` implementado en codigo: headers de seguridad en backend (`helmet`) y politicas de headers web del portal en Cloudflare Pages (`platform-portal/_headers`).

Estado de verificacion remota (Cloudflare, `admin.tucofitness.com`, 2026-04-08):

- headers requeridos presentes en respuesta HTTP viva: `content-security-policy`, `x-frame-options`, `x-content-type-options`, `strict-transport-security`, `referrer-policy`, `permissions-policy`.
- validacion en vivo: **PASS** usando `scripts/verify-portal-headers.ps1` + comprobacion raw con `curl`.
- estado: sincronizacion de headers en Cloudflare completada para `admin.tucofitness.com`.

Verificacion automatizada disponible:

- script: `scripts/verify-portal-headers.ps1`
- resultado actual: **PASS** (sin faltantes).

**INF-SEC-01 CERRADO** (2026-04-08). Smoke staging PASS=7 FAIL=0. Produccion N/A (entorno unico en piloto).