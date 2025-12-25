-- check_audit_reports_schema.sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_reports'
ORDER BY ordinal_position;
