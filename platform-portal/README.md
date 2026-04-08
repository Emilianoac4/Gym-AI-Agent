# Portal Central - Fuente de Verdad (Cloudflare)

## Carpeta activa de despliegue

Cloudflare Pages publica desde esta carpeta:

- `platform-portal/`

## Archivos operativos obligatorios

- Seguridad HTTP: `platform-portal/_headers`
- Ruteo SPA: `platform-portal/_redirects`

## Regla de mantenimiento

1. Cualquier cambio de headers o redirects se hace primero en esta carpeta.
2. Despues de desplegar, validar en vivo:

```powershell
curl -I https://admin.tucofitness.com
```

3. Confirmar presencia de al menos:
   - `content-security-policy`
   - `x-frame-options`
   - `x-content-type-options`
   - `strict-transport-security`
   - `referrer-policy`
   - `permissions-policy`

## Nota sobre carpeta anidada

`platform-portal/platform-portal/` no es la fuente de verdad de despliegue actual.
