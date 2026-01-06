-- Phase 9: Operation Logs (Reviving 'logs' table)

-- 1. Create or Reset logs table
CREATE TABLE IF NOT EXISTS logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    actor_name text,
    actor_code text,
    occurred_at timestamptz DEFAULT now(),
    is_archived boolean DEFAULT false,
    archived_at timestamptz
);

-- RLS
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
DROP POLICY IF EXISTS admin_all_logs ON logs;
CREATE POLICY admin_all_logs ON logs
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM employees
        WHERE auth_id = auth.uid()
        AND authority = 'admin'
    )
);

-- 2. Trigger Function to Capture Changes
CREATE OR REPLACE FUNCTION capture_operation_log()
RETURNS TRIGGER AS $$
DECLARE
    actor_record RECORD;
    actor_name TEXT;
    actor_code TEXT;
    old_val JSONB := NULL;
    new_val JSONB := NULL;
BEGIN
    -- 実行者の取得 (auth.uid() or JWT info から社員情報を特定)
    -- 注意: Next.js + Auth Helpers では DataContext のクライアントが正しく設定されていないと auth.uid() が NULL になることがあります
    SELECT id, name, employee_code, auth_id INTO actor_record FROM employees 
    WHERE auth_id = auth.uid()
       OR (
           -- auth_id が未紐付けの場合のフォールバック
           -- Auth ユーザー作成時に設定される app_metadata 経由、または email: code@ledger-system.local 経由
           employee_code = COALESCE(
               auth.jwt() -> 'app_metadata' ->> 'employee_code',
               split_part(auth.jwt() ->> 'email', '@', 1)
           )
       );
    
    -- 自己修復: auth_id が未紐付けなら自動的にリンクする (SECURITY DEFINER なので実行可能)
    -- これにより、次回以降の操作は auth_id で即座に特定可能になります
    IF actor_record.id IS NOT NULL AND actor_record.auth_id IS NULL AND auth.uid() IS NOT NULL THEN
        UPDATE employees SET auth_id = auth.uid() WHERE id = actor_record.id;
    END IF;

    actor_name := COALESCE(actor_record.name, 'システム');
    actor_code := COALESCE(actor_record.employee_code, 'SYSTEM');

    -- 操作内容に応じてデータを JSONB 形式で保存
    IF (TG_OP = 'DELETE') THEN
        old_val := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        old_val := to_jsonb(OLD);
        new_val := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        new_val := to_jsonb(NEW);
    END IF;

    -- ログの挿入
    INSERT INTO logs (
        table_name,
        operation,
        old_data,
        new_data,
        actor_name,
        actor_code,
        occurred_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        old_val,
        new_val,
        actor_name,
        actor_code,
        now()
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Triggers to all relevant tables

-- Master Tables
DROP TRIGGER IF EXISTS trg_log_employees ON employees;
CREATE TRIGGER trg_log_employees AFTER INSERT OR UPDATE OR DELETE ON employees FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

DROP TRIGGER IF EXISTS trg_log_areas ON areas;
CREATE TRIGGER trg_log_areas AFTER INSERT OR UPDATE OR DELETE ON areas FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

DROP TRIGGER IF EXISTS trg_log_addresses ON addresses;
CREATE TRIGGER trg_log_addresses AFTER INSERT OR UPDATE OR DELETE ON addresses FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

-- Device Tables
DROP TRIGGER IF EXISTS trg_log_tablets ON tablets;
CREATE TRIGGER trg_log_tablets AFTER INSERT OR UPDATE OR DELETE ON tablets FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

DROP TRIGGER IF EXISTS trg_log_iphones ON iphones;
CREATE TRIGGER trg_log_iphones AFTER INSERT OR UPDATE OR DELETE ON iphones FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

DROP TRIGGER IF EXISTS trg_log_featurephones ON featurephones;
CREATE TRIGGER trg_log_featurephones AFTER INSERT OR UPDATE OR DELETE ON featurephones FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

DROP TRIGGER IF EXISTS trg_log_routers ON routers;
CREATE TRIGGER trg_log_routers AFTER INSERT OR UPDATE OR DELETE ON routers FOR EACH ROW EXECUTE FUNCTION capture_operation_log();

-- 4. Archiving Function (Audit Log と同様の仕組み)
CREATE OR REPLACE FUNCTION cleanup_old_operation_logs(days_to_keep integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE logs
    SET is_archived = true,
        archived_at = now()
    WHERE is_archived = false
      AND occurred_at < (now() - (days_to_keep || ' days')::interval);
END;
$$;
