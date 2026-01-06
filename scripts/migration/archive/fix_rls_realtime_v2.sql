-- fix_rls_realtime_v2.sql
-- Run this if the previous script failed with a syntax error near "EXISTS".

DO $$
BEGIN
    -- 1. Create Policies for anon if they don't exist
    -- This provides visibility to the frontend if it's running as 'anon' role
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Enable read for anon') THEN
        CREATE POLICY "Enable read for anon" ON public.audit_logs FOR SELECT TO anon USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Enable insert for anon') THEN
        CREATE POLICY "Enable insert for anon" ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);
    END IF;

    -- 2. Reinforce Authenticated Role access just in case
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Enable read for authenticated') THEN
        CREATE POLICY "Enable read for authenticated" ON public.audit_logs FOR SELECT TO authenticated USING (true);
    END IF;

    -- 3. Publication Management (Safe version without IF EXISTS)
    -- Check if it's already a member before dropping
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE audit_logs;
    END IF;

    -- Re-add to ensure the logical replication slot is fresh
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

END $$;

-- 4. Enable full row data replication
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
