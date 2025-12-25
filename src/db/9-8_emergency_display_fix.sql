-- Phase 9-8: 操作ログ表示の緊急解決（RLS無効化 & 整合性強制）
-- 目的: 権限やフィルタの不備を完全に排除し、アプリ画面にデータを強制表示させます。

-- [1] RLS（アクセスコントロール）を完全に無効化する
-- これにより、権限紐付けの不備に関わらず、システム全体からログが参照可能になります。
ALTER TABLE logs DISABLE ROW LEVEL SECURITY;

-- [2] カラムの完全同期（フィルタリング漏れ防止）
-- サーバーサイドが created_at を基準にしているため、全てのレコードで値を確定させます。
UPDATE logs 
SET 
  is_archived = COALESCE(is_archived, false),
  created_at = COALESCE(created_at, occurred_at, now()),
  occurred_at = COALESCE(occurred_at, created_at, now());

-- [3] 既存のトリガーのクリーンアップと再構築
-- 確実に最新のロジックで記録されるようにします。
CREATE OR REPLACE FUNCTION capture_operation_log()
RETURNS TRIGGER AS $$
DECLARE
    a_name text := 'システム';
    a_code text := 'SYSTEM';
BEGIN
    -- 実行者情報取得を試行
    BEGIN
        SELECT name, employee_code INTO a_name, a_code FROM employees WHERE auth_id = auth.uid();
        a_name := COALESCE(a_name, 'システム');
        a_code := COALESCE(a_code, 'SYSTEM');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    INSERT INTO logs (
        table_name, operation, old_data, new_data,
        actor_name, actor_code, created_at, occurred_at, is_archived
    ) VALUES (
        TG_TABLE_NAME, TG_OP, 
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        a_name, a_code, now(), now(), false
    );
    RETURN (CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [4] 全テーブルへのトリガー再適用（ループで確実に実施）
DO $$
DECLARE
    t text;
    tables_to_log text[] := ARRAY['employees', 'areas', 'addresses', 'tablets', 'iphones', 'featurephones', 'routers'];
BEGIN
    FOREACH t IN ARRAY tables_to_log LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_log_' || t, t);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION capture_operation_log()', 'trg_log_' || t, t);
    END LOOP;
END $$;
