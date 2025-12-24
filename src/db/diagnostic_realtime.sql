-- diagnostic_realtime.sql
-- Run this in Supabase SQL Editor to verify why Realtime events are not reaching the client.

-- 1. Check if the 'supabase_realtime' publication exists and includes 'audit_logs'
SELECT pubname, tablename 
FROM pg_publication_tables 
WHERE tablename = 'audit_logs';

-- 2. If 'audit_logs' is NOT shown above, run this:
-- ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- 3. Check if 'audit_logs' has 'replica identity' set (needed for UPDATE/DELETE, but good to check)
SELECT relname, relreplident 
FROM pg_class 
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
WHERE relname = 'audit_logs' AND nspname = 'public';
-- 'd' = default, 'f' = full, 'i' = index, 'n' = nothing. Default or Full is required.

-- 4. Check if RLS is enabled and what policies exist
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'audit_logs';

SELECT * FROM pg_policies WHERE tablename = 'audit_logs';

-- 5. Force enable Realtime for this table specifically (Dashboard equivalent)
-- Sometimes the publication exists but the logical replication slot is stuck.
-- Running this can reset/ensure it.
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- 6. Verify if 'action_type' column is compatible with the filter used (it should be)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'audit_logs' AND column_name = 'action_type';
