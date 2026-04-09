# 21 - Go/No-Go de Seguridad para Publicacion (Play Store / App Store)

**Version**: 1.0  
**Fecha**: Abril 8, 2026  
**Estado**: Documento vivo (actualizar en cada ticket de seguridad)

---

## 1. Objetivo

Este documento define el estado real de cumplimiento de seguridad para decidir si la app puede publicarse en Google Play y App Store bajo criterios de seguridad alta.

Criterios evaluados:
- Proteccion de datos del usuario.
- Cifrado de informacion en transito (TLS/HTTPS).
- Solicitud de permisos minimos necesarios.
- Distribucion desde tiendas oficiales.

---

## 2. Regla de actualizacion obligatoria

Actualizar este documento en cada entrega de seguridad (BE-SEC, MOB-SEC, INF-SEC, WEB-SEC, AI-SEC):

1. Cambiar estado del criterio impactado (`NO CUMPLE`, `PARCIAL`, `CUMPLE`).
2. Agregar evidencia tecnica (archivo, test, pipeline o resultado operativo).
3. Registrar fecha y commit en la bitacora de cambios.

Sin esta actualizacion, el ticket de seguridad se considera incompleto.

---

## 3. Matriz de cumplimiento actual

| Criterio | Estado | Evidencia actual | Brecha pendiente |
|---|---|---|---|
| Protege datos del usuario | **PARCIAL ALTO** | Sesion segura en mobile ([mobile/src/context/AuthContext.tsx](mobile/src/context/AuthContext.tsx)); guardrails IA ([backend/src/modules/ai/ai.guardrails.ts](backend/src/modules/ai/ai.guardrails.ts)); retencion tecnica ([backend/src/services/data-retention.service.ts](backend/src/services/data-retention.service.ts)); pruebas de seguridad | MFA para admins (WEB-SEC-02), hardening mobile adicional (MOB-SEC-03/04), cerrar vulnerabilidades high |
| Cifra informacion (TLS/HTTPS) | **PARCIAL** | Hardening backend con helmet ([backend/src/app.ts](backend/src/app.ts)); deploy staging orientado a HTTPS ([docs/11_DEPLOY_STAGING.md](docs/11_DEPLOY_STAGING.md)) | En desarrollo local aun se usa HTTP ([mobile/README.md](mobile/README.md)); falta cierre MOB-SEC-04 (pinning/validacion reforzada) |
| Solo permisos necesarios | **PARCIAL BUENO** | Permisos y textos declarados en [mobile/app.json](mobile/app.json) | Revision final de minimo privilegio en mobile (MOB-SEC-03) |
| Descarga en tiendas oficiales | **PARCIAL** | Bundle/package configurados en [mobile/app.json](mobile/app.json) | Falta evidencia operativa de publicacion real en Google Play y App Store/TestFlight |

---

## 4. Estado de gates de seguridad automatica

| Gate | Estado | Evidencia |
|---|---|---|
| Pipeline de seguridad CI (INF-SEC-03) | **ACTIVO** | [.github/workflows/inf-sec-03-security-pipeline.yml](.github/workflows/inf-sec-03-security-pipeline.yml) |
| npm audit backend (high+) | **CUMPLE** | 0 vulnerabilidades high tras `npm audit fix` (Abril 8, 2026) |
| npm audit mobile (high+) | **CUMPLE** | 0 vulnerabilidades high tras override `@xmldom/xmldom>=0.8.12` en `mobile/package.json` (Abril 8, 2026) |

---

## 5. Condicion Go/No-Go para publicar en stores

### NO-GO (actual)

No se recomienda publicar como "seguridad alta" mientras exista al menos una de estas condiciones:
- Vulnerabilidades `high` en backend o mobile.
- MFA pendiente para admins privilegiados.
- Falta de evidencia de release oficial en stores.
- Hardening mobile TLS pendiente (decision/documentacion de pinning o alternativa aprobada).

### GO (objetivo)

Se considera apto para publicacion con lineamientos de seguridad cuando:
- `npm audit --omit=dev --audit-level=high` = 0 high en backend y mobile.
- WEB-SEC-02 y MOB-SEC-03/04 cerrados con evidencia.
- Release publicada y verificable en Google Play y App Store/TestFlight.
- Este documento actualizado a estado `CUMPLE` en los cuatro criterios.

---

## 6. Bitacora de cambios de seguridad

| Fecha | Ticket | Cambio | Commit | Resultado |
|---|---|---|---|---|
| 2026-04-08 | INF-SEC-02 | Runbook backup/restore + simulacro + health checks | 280bc57 | Mejora resiliencia operativa |
| 2026-04-08 | INF-SEC-04 | Alertas operativas para picos 401/403/429/500 | 280bc57 | Mejora deteccion temprana |
| 2026-04-08 | BE-SEC-05 | Avatar en storage seguro con URL firmada | 656ceee | Reduce exposicion de imagenes en BD |
| 2026-04-08 | BE-SEC-06 | Retencion y expiracion tecnica de datos sensibles | 8ce7df8 | Menor superficie de datos historicos |
| 2026-04-08 | AI-SEC-01 | Clasificador backend + guardrails verificables | b62eff3 | Control de alcance IA |
| 2026-04-08 | AI-SEC-02 | Disclaimer fitness no medico uniforme | 72883a6 | Control de riesgo medico en respuestas |
| 2026-04-08 | INF-SEC-03 | Pipeline CI security gates | ef435ba | Bloquea regresiones de seguridad |
| 2026-04-08 | INF-SEC-03-REM-DEP-001 (Fase A) | Remediacion backend completada: audit high de 4 a 0 + typecheck/test security PASS | 1dae01b | Gate backend desbloqueado |
| 2026-04-08 | INF-SEC-03-REM-DEP-001 (Fase B) | Remediacion mobile: override `@xmldom/xmldom>=0.8.12`, react-native-health@1.19.0 conservado, audit high 4 a 0, typecheck PASS | pendiente commit | Gate mobile desbloqueado |

---

## 7. Responsable de mantenimiento

- Responsable tecnico: equipo backend/security.
- Frecuencia minima de revision: cada cierre de ticket de seguridad o, como maximo, una vez por sprint.
