-- CHECK POLICIES
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'audit_logs';

-- CHECK RLS STATUS
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE relname = 'audit_logs' AND nspname = 'public';
