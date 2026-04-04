-- Fix: dos problemas de schema drift en user_profiles.
-- Seguro ejecutar multiples veces (IF NOT EXISTS).
--
-- Problema 1 (P2022): avatar_url no existia en la DB aunque si en schema.prisma.
--   Causa: creado en master_schema_staging.sql pero nunca como migracion incremental.
--   Efecto: 500 en POST /users, GET/PUT /users/:id/profile, GET /operations/active-trainers,
--           POST /ai/:id/routine y cualquier query que haga include: { profile: true }.
--
-- Problema 2 (42P10): falta UNIQUE INDEX en user_profiles.user_id.
--   Causa: Prisma upsert genera ON CONFLICT (user_id) que requiere un unique index/constraint.
--   Efecto: 500 en PUT /users/:id/profile (updateUserProfileById).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_user_id_key"
  ON public.user_profiles("user_id");
