-- fix_rls_update_anon.sql
-- Run this to allow the notification system (even as 'anon') to mark logs as read.

DO $$
BEGIN
    -- 1. Add UPDATE policy for anon if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Enable update for anon'
    ) THEN
        CREATE POLICY "Enable update for anon" ON public.audit_logs 
        FOR UPDATE TO anon 
        USING (is_acknowledged = false)
        WITH CHECK (true);
    END IF;

    -- 2. Reinforce Authenticated role update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Enable update for authenticated'
    ) THEN
        CREATE POLICY "Enable update for authenticated" ON public.audit_logs 
        FOR UPDATE TO authenticated 
        USING (is_acknowledged = false)
        WITH CHECK (true);
    END IF;
END $$;
