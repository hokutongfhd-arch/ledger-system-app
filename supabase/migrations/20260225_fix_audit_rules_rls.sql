-- 管理者（Admin）に不正検知ルールの更新権限を付与
-- これにより、重要度やパラメータの保存が可能になります。

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_anomaly_rules' 
        AND policyname = 'audit_rules_admin_update'
    ) THEN
        CREATE POLICY "audit_rules_admin_update"
        ON public.audit_anomaly_rules
        FOR UPDATE
        TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;
END $$;
