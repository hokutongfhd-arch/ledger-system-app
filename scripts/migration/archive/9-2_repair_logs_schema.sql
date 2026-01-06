-- 操作ログ（logsテーブル）の構造修正SQL
-- 既存のlogsテーブルを維持しつつ、差分記録に必要なカラムを追加します。

DO $$ 
BEGIN
    -- 1. 不足しているカラムの追加
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='table_name') THEN
        ALTER TABLE logs ADD COLUMN table_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='operation') THEN
        ALTER TABLE logs ADD COLUMN operation text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='old_data') THEN
        ALTER TABLE logs ADD COLUMN old_data jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='new_data') THEN
        ALTER TABLE logs ADD COLUMN new_data jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='actor_name') THEN
        ALTER TABLE logs ADD COLUMN actor_name text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='actor_code') THEN
        ALTER TABLE logs ADD COLUMN actor_code text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='occurred_at') THEN
        ALTER TABLE logs ADD COLUMN occurred_at timestamptz DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='is_archived') THEN
        ALTER TABLE logs ADD COLUMN is_archived boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='archived_at') THEN
        ALTER TABLE logs ADD COLUMN archived_at timestamptz;
    END IF;
END $$;

-- 2. 既存データの移行（古いカラムから新しいカラムへコピー & 正規化）
UPDATE logs 
SET 
    table_name = COALESCE(table_name, target),
    operation = COALESCE(operation, 
        CASE 
            WHEN action = 'add' THEN 'INSERT'
            WHEN action = 'update' THEN 'UPDATE'
            WHEN action = 'delete' THEN 'DELETE'
            ELSE UPPER(action) 
        END
    ),
    actor_name = COALESCE(actor_name, "user"),
    occurred_at = COALESCE(occurred_at, created_at)
WHERE table_name IS NULL OR operation IS NULL;

-- 3. トリガー関数の再定義（確実に新しいカラムに書き込むようにする）
CREATE OR REPLACE FUNCTION capture_operation_log()
RETURNS TRIGGER AS $$
DECLARE
    actor_record RECORD;
    old_val JSONB := NULL;
    new_val JSONB := NULL;
    op_name TEXT;
BEGIN
    -- 実行者の取得
    SELECT name, employee_code INTO actor_record FROM employees WHERE auth_id = auth.uid();
    
    -- 操作内容の正規化
    op_name := TG_OP;

    -- データ取得
    IF (TG_OP = 'DELETE') THEN
        old_val := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        old_val := to_jsonb(OLD);
        new_val := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        new_val := to_jsonb(NEW);
    END IF;

    -- 新旧両方のカラムに書き込む（互換性のため）
    INSERT INTO logs (
        table_name, target,
        operation, action,
        old_data, new_data,
        actor_name, "user",
        actor_code,
        occurred_at, created_at
    ) VALUES (
        TG_TABLE_NAME, TG_TABLE_NAME,
        op_name, LOWER(op_name),
        old_val, new_val,
        COALESCE(actor_record.name, 'システム'), COALESCE(actor_record.name, 'システム'),
        COALESCE(actor_record.employee_code, 'SYSTEM'),
        now(), now()
    );

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLSの再確認（確実に閲覧できるようにする）
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_logs ON logs;
CREATE POLICY admin_all_logs ON logs FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM employees WHERE auth_id = auth.uid() AND authority = 'admin'));
