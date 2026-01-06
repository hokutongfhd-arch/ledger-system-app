-- Phase 9-4: 操作ログ(logsテーブル)の完全修復
-- 目的: 本番環境でのカラム不整合とトリガーの不備を解消し、更新ログが確実に表示されるようにします。

-- [1] カラムの追加と整合性確保
DO $$ 
BEGIN
    -- サーバーサイドが期待する created_at を追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='created_at') THEN
        ALTER TABLE logs ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;

    -- 旧来のカラムとの互換性のために不足分を追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='user') THEN
        ALTER TABLE logs ADD COLUMN "user" text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='action') THEN
        ALTER TABLE logs ADD COLUMN action text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='target') THEN
        ALTER TABLE logs ADD COLUMN target text;
    END IF;

    -- table_name と operation が存在することを確認
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='table_name') THEN
        ALTER TABLE logs ADD COLUMN table_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='operation') THEN
        ALTER TABLE logs ADD COLUMN operation text;
    END IF;
END $$;

-- 既存データの同期 (occurred_at -> created_at)
UPDATE logs SET created_at = occurred_at WHERE created_at IS NULL;
UPDATE logs SET occurred_at = created_at WHERE occurred_at IS NULL;
UPDATE logs SET "user" = actor_name WHERE "user" IS NULL;
UPDATE logs SET action = LOWER(operation) WHERE action IS NULL;
UPDATE logs SET target = table_name WHERE target IS NULL;

-- [2] トリガー関数の再定義 (堅牢版)
CREATE OR REPLACE FUNCTION capture_operation_log()
RETURNS TRIGGER AS $$
DECLARE
    actor_record RECORD;
    old_val JSONB := NULL;
    new_val JSONB := NULL;
    op_name TEXT;
    a_name TEXT;
    a_code TEXT;
BEGIN
    -- 実行者の特定 (より広範なフォールバック)
    SELECT name, employee_code INTO actor_record FROM employees WHERE auth_id = auth.uid();
    
    IF actor_record.name IS NULL THEN
        -- auth.jwt() からの情報取得
        a_name := COALESCE(
            auth.jwt() ->> 'email',
            'システム'
        );
        a_code := COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'employee_code',
            'SYSTEM'
        );
    ELSE
        a_name := actor_record.name;
        a_code := actor_record.employee_code;
    END IF;

    -- 操作内容の判定
    op_name := TG_OP;

    -- データのキャプチャ
    IF (TG_OP = 'DELETE') THEN
        old_val := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        old_val := to_jsonb(OLD);
        new_val := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        new_val := to_jsonb(NEW);
    END IF;

    -- ログの挿入 (全てのカラムに対して安全に書き込む)
    INSERT INTO logs (
        table_name, target,
        operation, action,
        old_data, new_data,
        actor_name, "user",
        actor_code,
        occurred_at, created_at,
        is_archived
    ) VALUES (
        TG_TABLE_NAME, TG_TABLE_NAME,
        op_name, LOWER(op_name),
        old_val, new_val,
        a_name, a_name,
        a_code,
        now(), now(),
        false
    );

    -- 元の操作を続行
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [3] トリガーの再適用 (既存を一旦削除して確実に最新を貼る)
-- 既に存在する場合は DROP/CREATE で確実に更新
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
