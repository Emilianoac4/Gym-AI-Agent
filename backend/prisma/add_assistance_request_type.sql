-- Agrega la columna type a assistance_requests para categorizar el tipo de alerta.
-- Valores esperados: 'acoso', 'incidente', 'accidente', 'lesion', u otros.
-- Nullable para compatibilidad con registros existentes.
-- Seguro ejecutar multiples veces (IF NOT EXISTS).

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS type VARCHAR(50);
