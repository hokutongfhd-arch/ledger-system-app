-- RLS Safety Check SQL
-- Description: Detects tables with disabled RLS, missing policies, or dangerous public access.
-- Usage: Run this in Supabase SQL Editor. If any query returns rows, IMMEDIATE ACTION REQUIRED.

-- 1. Detect Tables with RLS DISABLED (Should be 0 rows)
SELECT 
    n.nspname AS schema,
    c.relname AS table_name,
    CASE 
        WHEN c.relrowsecurity THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END AS rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r' -- Ordinary tables
  AND c.relrowsecurity = FALSE
  AND c.relname NOT LIKE 'pg_%'
  AND c.relname NOT LIKE 'full_text_%'; -- Exclude internal/Supabase tables if any

-- 2. Detect Tables without FORCE RLS (Recommendation, not critical failure usually)
-- Note: Supabase UI "Enable RLS" sets relrowsecurity=true. relforcerowsecurity=true is "Force RLS".
SELECT 
    n.nspname AS schema,
    c.relname AS table_name,
    'WARNING: Force RLS not set' AS issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relforcerowsecurity = FALSE;

-- 3. Detect Dangerous Public/Anon Policies (Should be 0 rows except device_manuals SELECT)
SELECT 
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    'anon' = ANY(roles) OR 'public' = ANY(roles)
  )
  AND NOT (
    tablename = 'device_manuals' AND cmd = 'SELECT'
  );

-- 4. Detect User/Anon Write Access to Logs (Should be 0 rows)
SELECT 
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('logs', 'app_logs', 'audit_logs', 'audit_anomaly_rules', 'audit_reports')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  AND (
    'anon' = ANY(roles) OR 'public' = ANY(roles) OR 'authenticated' = ANY(roles)
  );
  -- Service Role is not listed in 'roles' typically (it bypasses RLS), but if specified explicitly as 'service_role', it's fine.
  -- The danger is 'authenticated', 'anon', 'public'.

-- 5. Detect Admin Policies that do not check strict admin conditions
-- (Difficult to parse strictly via SQL string, but we can list policies for manual review)
-- SELECT tablename, policyname, qual FROM pg_policies WHERE policyname LIKE '%admin%';
