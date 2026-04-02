-- Limpieza de datos para reiniciar validaciones funcionales.
-- Mantiene estructura de tablas y tipos, pero elimina datos de negocio.

BEGIN;

TRUNCATE TABLE ai_chat_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE measurements RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE gyms RESTART IDENTITY CASCADE;

COMMIT;
