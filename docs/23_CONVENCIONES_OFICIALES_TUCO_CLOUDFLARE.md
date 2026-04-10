# Tuco - Convenciones Oficiales de Marca y Despliegue Web

**Estado**: Activo (normativa vigente)
**Ultima actualizacion**: Abril 10, 2026
**Alcance**: Documentacion, despliegue del portal, comunicacion tecnica y operativa

---

## 1. Decision oficial

Este proyecto adopta de forma oficial las siguientes reglas:

1. Nombre del producto/plataforma: **Tuco**.
2. Hosting del portal central web: **Cloudflare** (Cloudflare Pages).
3. Queda deprecado usar Netlify como referencia operativa en documentacion activa.

Estas reglas aplican para:
- Documentacion tecnica y funcional.
- Runbooks operativos.
- Onboarding de nuevos desarrolladores.
- Checklist de despliegue y troubleshooting del portal central.

---

## 2. Convencion de naming (marca)

### 2.1 Nombre correcto

Usar siempre:
- Tuco
- Tuco Fitness Center (cuando aplique contexto de plataforma central)

Evitar en nuevas piezas:
- GymAI
- Gym IA
- Gym-AI

### 2.2 Regla editorial en documentos

1. Si un documento es vigente, el nombre primario debe ser "Tuco".
2. Si se conserva contexto historico, usar formato:
   - "Tuco (antes GymAI)" solo cuando sea estrictamente necesario para trazabilidad.
3. No crear titulos nuevos con "GymAI".
4. En UI, prompts y textos de producto, el asistente debe nombrarse "Tuco".

### 2.3 Impacto esperado

- Menos ambiguedad entre marca interna y marca visible al cliente.
- Menor riesgo de errores al mapear requerimientos de negocio con implementacion.
- Coherencia en soporte y comunicacion con gimnasios.

---

## 3. Convencion de despliegue del portal (Cloudflare)

### 3.1 Fuente de verdad de despliegue

El portal central se despliega desde:
- `platform-portal/`

Archivos clave obligatorios en esa carpeta:
- `_headers`
- `_redirects`
- `index.html`
- `app.js`
- `styles.css`

La carpeta:
- `platform-portal/platform-portal/`

se mantiene solo por legado/contingencia y **no** es la fuente oficial de despliegue.

### 3.2 Regla de proveedor

Proveedor oficial para portal:
- Cloudflare Pages

Estado de Netlify:
- No usar en nuevos despliegues ni en runbooks activos.
- Si aparece en documentos antiguos, tratarlo como referencia historica, no operativa.

### 3.3 Flujo operativo recomendado

1. Implementar cambios en `platform-portal/`.
2. Publicar en Cloudflare Pages.
3. Validar dominio productivo del portal.
4. Verificar headers de seguridad en entorno vivo.
5. Ejecutar smoke checks funcionales del panel central.

---

## 4. Controles de calidad documentales

Antes de cerrar cualquier PR/documentacion:

1. Buscar menciones nuevas de "GymAI" y corregir a "Tuco" cuando corresponda.
2. Confirmar que no se introduzcan instrucciones activas de Netlify para el portal.
3. Validar que las rutas y runbooks de portal referencien Cloudflare.
4. Actualizar indice documental si se agrega una nueva normativa.

Checklist rapido:
- [ ] Titulo y resumen usan Tuco.
- [ ] Seccion de despliegue web menciona Cloudflare.
- [ ] No hay pasos de Netlify en documentos vigentes.
- [ ] Se preserva trazabilidad historica solo donde aporta valor.

---

## 5. Migracion de documentacion legado

### 5.1 Estrategia

1. Prioridad alta: documentos de setup, deploy, seguridad y runbooks.
2. Prioridad media: roadmap y planes de implementacion.
3. Prioridad baja: documentos historicos archivados.

### 5.2 Criterio de done

Un documento se considera alineado cuando:
- Usa "Tuco" como nombre principal.
- Alinea portal con Cloudflare como proveedor activo.
- No contiene pasos operativos contradictorios con la realidad actual.

---

## 6. Riesgos mitigados con esta normativa

1. Deploys fallidos por ejecutar instrucciones en proveedor incorrecto.
2. Confusion de marca en equipos de producto/comercial/soporte.
3. Inconsistencias en auditorias internas y controles de seguridad.
4. Errores de onboarding por documentacion desactualizada.

---

## 7. Referencias internas

- `platform-portal/README.md` (fuente de verdad del deploy en Cloudflare)
- `docs/11_DEPLOY_STAGING.md`
- `docs/07_SETUP_CONFIGURACION.md`
- `docs/10_INDICE_DOCUMENTACION.md`
