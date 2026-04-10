-- TUCO - VALIDATION: user_pathologies schema in Supabase
-- Run in Supabase SQL Editor after applying add_user_pathologies.sql

SELECT 'table_exists' AS check_name,
       CASE WHEN to_regclass('public.user_pathologies') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
       COALESCE(to_regclass('public.user_pathologies')::text, 'missing') AS detail;

SELECT 'required_columns' AS check_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_pathologies'
  AND column_name IN (
    'id',
    'user_id',
    'pathology_key',
    'custom_label',
    'notes',
    'diagnosed_at',
    'is_active',
    'allow_trainer_view',
    'deactivated_at',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

SELECT 'missing_required_columns' AS check_name,
       required.column_name,
       CASE WHEN actual.column_name IS NULL THEN 'FAIL' ELSE 'PASS' END AS status
FROM (
  VALUES
    ('id'),
    ('user_id'),
    ('pathology_key'),
    ('custom_label'),
    ('notes'),
    ('diagnosed_at'),
    ('is_active'),
    ('allow_trainer_view'),
    ('deactivated_at'),
    ('created_at'),
    ('updated_at')
) AS required(column_name)
LEFT JOIN information_schema.columns actual
  ON actual.table_schema = 'public'
 AND actual.table_name = 'user_pathologies'
 AND actual.column_name = required.column_name
ORDER BY required.column_name;

SELECT 'indexes' AS check_name,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_pathologies'
ORDER BY indexname;

SELECT 'expected_index_unique' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'user_pathologies'
           AND indexname = 'idx_user_pathologies_user_key_label_unique'
       ) THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'expected_index_active' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'user_pathologies'
           AND indexname = 'idx_user_pathologies_user_active'
       ) THEN 'PASS' ELSE 'FAIL' END AS status;

SELECT 'row_count' AS check_name,
       COUNT(*)::int AS total_rows
FROM public.user_pathologies;
