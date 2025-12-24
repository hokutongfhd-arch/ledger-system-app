-- fix_rls_realtime.sql
-- Run this to allow the notification system (even as 'anon') to see anomaly logs.

-- 1. Check current policies
-- SELECT * FROM pg_policies WHERE tablename = 'audit_logs';

-- 2. Add policies for the 'anon' role (This is why it was 0 items)
-- In Phase 6-1, only 'authenticated' was allowed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Enable read for anon'
    ) THEN
        CREATE POLICY "Enable read for anon" ON public.audit_logs 
        FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Enable insert for anon'
    ) THEN
        CREATE POLICY "Enable insert for anon" ON public.audit_logs 
        FOR INSERT TO anon WITH CHECK (true);
    END IF;
END
$$;

-- 3. Ensure already existing policies are broad enough
-- (Phase 6-1 policies might exist, let's reinforce them)
ALTER POLICY "Enable read usage for authenticated users" ON audit_logs TO authenticated USING (true);
ALTER POLICY "Enable insert for authenticated users" ON audit_logs TO authenticated WITH CHECK (true);

-- 4. Re-verify Realtime Publication (Final check)
-- Even if member, re-adding can sometimes poke the replication slot.
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
