-- diag_audit_logs.sql
-- Check the column structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'audit_logs';

-- Check RLS status and policies
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'audit_logs';

SELECT * FROM pg_policies WHERE tablename = 'audit_logs';
