-- Andertrack Phase 2–4 STAGING AUDIT: read-only diagnostic SQL.
-- Run only after all migrations have been applied to staging.
-- This does not change data, privileges or schema.
SELECT current_database() AS database_name, now() AS audit_at;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'at_%'
ORDER BY tablename;
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname IN ('public','storage')
  AND (tablename LIKE 'at_%' OR tablename IN ('driver_location_current','objects'))
ORDER BY schemaname, tablename, policyname;
SELECT routine_schema, routine_name, security_type
FROM information_schema.routines
WHERE routine_schema IN ('public','at_private')
  AND routine_name LIKE '%assignment%'
ORDER BY routine_schema, routine_name;
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='at-delivery-evidence';
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name LIKE 'at_%'
  AND grantee IN ('anon','authenticated')
ORDER BY table_name,grantee,privilege_type;
