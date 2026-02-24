-- Migration: 20260224_add_details_column_to_audit_logs.sql
-- Description: Add missing 'details' column to audit_logs to support Edge Function notifications.

DO $$ 
BEGIN
    -- details カラムの追加 (Edge Function でメール本文に使用)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='details') THEN
        ALTER TABLE public.audit_logs ADD COLUMN details TEXT;
    END IF;

    -- severity カラムの存在確認 (既にあるはずだが念のため)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='severity') THEN
        ALTER TABLE public.audit_logs ADD COLUMN severity TEXT DEFAULT 'low';
    END IF;
END $$;
