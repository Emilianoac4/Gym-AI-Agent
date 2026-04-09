# 22 - Ticket: Remediacion de Dependencias (INF-SEC-03)

**Ticket ID**: INF-SEC-03-REM-DEP-001  
**Fecha**: Abril 8, 2026  
**Prioridad**: Critica  
**Estado**: Abierto

---

## 1. Objetivo

Eliminar vulnerabilidades de severidad `high` en backend y mobile para dejar en verde el nuevo gate de CI de seguridad (`npm audit --omit=dev --audit-level=high`).

---

## 2. Contexto

El pipeline de seguridad ya esta activo en:
- [.github/workflows/inf-sec-03-security-pipeline.yml](.github/workflows/inf-sec-03-security-pipeline.yml)

Actualmente el gate falla por vulnerabilidades high en ambos proyectos.

---

## 3. Hallazgos actuales (evidencia)

### Backend (4 high)

| Paquete vulnerable | Severidad | Ruta de dependencia | Fix available | Riesgo de breaking |
|---|---|---|---|---|
| prisma | high | `prisma` | si | no confirmado |
| @prisma/config | high | `prisma > @prisma/config` | si | bajo-medio |
| defu | high | `prisma > @prisma/config > c12 > defu` | si | bajo-medio |
| effect | high | `prisma > @prisma/config > effect` | si | bajo-medio |

### Mobile (4 high)

| Paquete vulnerable | Severidad | Ruta de dependencia | Fix available | Riesgo de breaking |
|---|---|---|---|---|
| react-native-health | high | `react-native-health` | `react-native-health@1.13.0` | **alto (semver major)** |
| @expo/config-plugins | high | `expo > @expo/config-plugins` | via `react-native-health@1.13.0` | alto |
| @expo/plist | high | `expo > @expo/config-plugins > @expo/plist` | via `react-native-health@1.13.0` | alto |
| @xmldom/xmldom | high | `expo > @expo/config-plugins > @expo/plist > @xmldom/xmldom` | via `react-native-health@1.13.0` | alto |

---

## 4. Alcance tecnico

1. Backend
- Actualizar dependencias relacionadas a Prisma hasta resolver advisories high.
- Verificar compatibilidad de comandos `prisma generate`, build y test.

2. Mobile
- Evaluar upgrade de `react-native-health` a version corregida y su impacto en Expo/HealthKit.
- Ajustar plugins/config si la version nueva lo requiere.
- Validar build dev-client iOS/Android y flujos de health permissions.

3. CI
- Confirmar pipeline INF-SEC-03 en verde tras remediacion.

---

## 5. Plan de ejecucion

### Fase A - Backend (bajo riesgo)

1. Ejecutar `npm audit fix` en `backend`.
2. Si persiste high, actualizar `prisma`/`@prisma/client` a versiones compatibles.
3. Validar:
- `npm run typecheck`
- `npm run test:security`
- `npm run build`

### Fase B - Mobile (riesgo alto por major)

1. Crear rama tecnica para upgrade de `react-native-health`.
2. Aplicar upgrade controlado de `react-native-health` y lockfile.
3. Validar:
- `npm run typecheck`
- build dev-client iOS/Android
- permiso HealthKit / Health Connect
- login + flujo principal de app

### Fase C - Cierre CI

1. Ejecutar auditorias finales:
- `cd backend && npm audit --omit=dev --audit-level=high`
- `cd mobile && npm audit --omit=dev --audit-level=high`
2. Confirmar `0 vulnerabilities` high en ambos.
3. Verificar workflow de GitHub Actions en verde.

---

## 6. Criterios de aceptacion (DoD)

- [ ] Backend `npm audit --omit=dev --audit-level=high` retorna exit code 0.
- [ ] Mobile `npm audit --omit=dev --audit-level=high` retorna exit code 0.
- [ ] `npm run test:security` pasa completo.
- [ ] `npm run typecheck` pasa en backend y mobile.
- [ ] Workflow INF-SEC-03 pasa en PR/push.
- [ ] Documento Go/No-Go actualizado: [docs/21_GO_NO_GO_SEGURIDAD_PUBLICACION.md](docs/21_GO_NO_GO_SEGURIDAD_PUBLICACION.md).

---

## 7. Riesgos y mitigacion

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Upgrade major de `react-native-health` rompe integracion nativa | Alto | Pruebas en rama aislada + smoke nativo + rollback rapido |
| Cambios de Prisma afectan migraciones/scripts | Medio | Versionado gradual + ejecutar `prisma generate` y pruebas de seguridad |
| CI bloqueado por nuevas vulnerabilidades transitorias | Medio | Congelar versiones estables y documentar excepciones temporales justificadas |

---

## 8. Entregables esperados

1. `package.json` / `package-lock.json` backend y mobile actualizados.
2. Evidencia de auditorias en 0 high.
3. Resultado de workflow INF-SEC-03 en verde.
4. Actualizacion del estado de seguridad en [docs/21_GO_NO_GO_SEGURIDAD_PUBLICACION.md](docs/21_GO_NO_GO_SEGURIDAD_PUBLICACION.md).
