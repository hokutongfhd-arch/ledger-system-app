-- final_rls_notification_fix.sql
-- このSQLは、通知を既読にするための全ての権限（テーブルレベル & RLS）を修正します。

-- 1. テーブルレベルの権限付与（anon と authenticated 両方）
GRANT SELECT, INSERT, UPDATE ON TABLE public.audit_logs TO anon, authenticated;

-- 2. RLSポリシーの再設定
DO $$
BEGIN
    -- 既存の更新ポリシーを一旦整理（もしあれば）
    DROP POLICY IF EXISTS "Enable update for anon" ON public.audit_logs;
    DROP POLICY IF EXISTS "Enable update for authenticated" ON public.audit_logs;

    -- 未ログイン(anon)用の更新ポリシー
    CREATE POLICY "Enable update for anon" ON public.audit_logs 
    FOR UPDATE TO anon 
    USING (is_acknowledged = false)
    WITH CHECK (true);

    -- ログイン済み(authenticated)用の更新ポリシー
    CREATE POLICY "Enable update for authenticated" ON public.audit_logs 
    FOR UPDATE TO authenticated 
    USING (is_acknowledged = false)
    WITH CHECK (true);

    -- 読み取り権限も念のため再確認（anon）
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Enable read for anon') THEN
        CREATE POLICY "Enable read for anon" ON public.audit_logs FOR SELECT TO anon USING (true);
    END IF;

    -- 読み取り権限も念のため再確認（authenticated）
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Enable read usage for authenticated users') THEN
        CREATE POLICY "Enable read usage for authenticated users" ON public.audit_logs FOR SELECT TO authenticated USING (true);
    END IF;

END $$;
