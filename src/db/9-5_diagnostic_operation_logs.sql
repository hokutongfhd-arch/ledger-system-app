-- Phase 9-5: 操作ログ診断 & 最終同期スクリプト
-- 目的: なぜログが表示されないのかを特定し、強制的に表示可能な状態にします。

-- [1] 診断セクション (結果は Messages タブに出力されます)
DO $$ 
DECLARE
    log_count int;
    admin_check boolean;
    trigger_check int;
BEGIN
    SELECT count(*) INTO log_count FROM logs;
    RAISE NOTICE '--- 診断開始 ---';
    RAISE NOTICE '1. logsテーブルの総レコード数: % 件', log_count;

    SELECT EXISTS (
        SELECT 1 FROM employees 
        WHERE auth_id = auth.uid() 
        AND authority = 'admin'
    ) INTO admin_check;
    RAISE NOTICE '2. 現在のユーザー(SQL実行者)の管理者権限チェック: %', admin_check;
    RAISE NOTICE '   (注: Dashboardからの実行時は通常 false になります)';

    SELECT count(*) INTO trigger_check 
    FROM pg_trigger 
    WHERE tgname LIKE 'trg_log_%';
    RAISE NOTICE '3. 設定されている操作ログトリガー数: % 個', trigger_check;

    RAISE NOTICE '4. logsテーブルの現在のカラム構成:';
END $$;

-- カラム構成の表示
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'logs'
ORDER BY ordinal_position;

-- 直近のログ 5件の確認
SELECT id, table_name, operation, actor_name, created_at, is_archived
FROM logs
ORDER BY created_at DESC
LIMIT 5;

-- [2] 修復セクション: サーバー側のクエリとの不一致を解消
-- サーバーサイド (operationLogs.server.ts) は created_at を基準にソート・フィルタします。
-- もし occurred_at しかない、あるいは created_at が NULL だと表示されません。
UPDATE logs SET created_at = occurred_at WHERE created_at IS NULL;
UPDATE logs SET occurred_at = created_at WHERE occurred_at IS NULL;

-- もし実行者の auth_id が employees テーブルに紐付いていない場合、
-- アプリ画面の RLS でデータが 0件として扱われてしまいます。
-- 管理者自身を強制的に管理者としてマークする (auth_id がある場合)
UPDATE employees 
SET authority = 'admin' 
WHERE auth_id = auth.uid() 
  AND authority != 'admin';

-- [3] トリガー関数の再・再定義 (よりシンプルでエラーになりにくい構造)
CREATE OR REPLACE FUNCTION capture_operation_log()
RETURNS TRIGGER AS $$
DECLARE
    a_name text := 'システム';
    a_code text := 'SYSTEM';
    old_v jsonb := null;
    new_v jsonb := null;
BEGIN
    -- 実行者特定
    BEGIN
        SELECT name, employee_code INTO a_name, a_code 
        FROM employees 
        WHERE auth_id = auth.uid();
        
        a_name := COALESCE(a_name, 'システム');
        a_code := COALESCE(a_code, 'SYSTEM');
    EXCEPTION WHEN OTHERS THEN
        a_name := 'システム(エラー)';
    END;

    -- データ取得
    IF (TG_OP = 'DELETE') THEN
        old_v := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        old_v := to_jsonb(OLD);
        new_v := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        new_v := to_jsonb(NEW);
    END IF;

    -- 挿入 (存在が確実なカラムのみ、またはCOALESCEで安全に)
    INSERT INTO logs (
        table_name,
        operation,
        old_data,
        new_data,
        actor_name,
        actor_code,
        created_at,
        occurred_at,
        is_archived
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        old_v,
        new_v,
        a_name,
        a_code,
        now(),
        now(),
        false
    );

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーの再接続は 9-4 で行ったはずですが、念のため employees だけでも再貼付
DROP TRIGGER IF EXISTS trg_log_employees ON employees;
CREATE TRIGGER trg_log_employees AFTER INSERT OR UPDATE OR DELETE ON employees FOR EACH ROW EXECUTE FUNCTION capture_operation_log();
