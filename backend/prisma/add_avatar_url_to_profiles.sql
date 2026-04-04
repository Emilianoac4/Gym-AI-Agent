-- Agrega avatar_url a user_profiles.
-- Este campo estaba en master_schema_staging.sql pero nunca se creo
-- como migracion incremental. Su ausencia causa Internal Server Error 500
-- en cualquier operacion Prisma que escriba o lea el perfil completo
-- (upsert, create, include: { profile: true }).
-- Seguro ejecutar multiples veces (IF NOT EXISTS).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
