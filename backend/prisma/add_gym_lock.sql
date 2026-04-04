-- Agrega locked_at a gyms para permitir bloquear/desbloquear
-- el acceso de TODOS los usuarios de un gimnasio desde el portal
-- de plataforma, independientemente del estado de suscripcion.
-- NULL = acceso normal. NOT NULL = acceso bloqueado.
-- Seguro ejecutar multiples veces (IF NOT EXISTS).

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP(3);
