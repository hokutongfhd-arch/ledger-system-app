-- Phase 6-6: 不正検知対応の証跡管理 (Traceability)

-- 1. Create Enum for Response Status
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anomaly_response_status') THEN
        DROP TYPE anomaly_response_status CASCADE;
    END IF;
    CREATE TYPE anomaly_response_status AS ENUM (
        'pending',       -- 調査前
        'investigating', -- 調査中
        'completed'      -- 完了
    );
END $$;

-- 2. Add Tracking Columns to audit_logs
-- acknowledged_by: 対応した管理者
-- acknowledged_at: 対応日時
-- response_status: 対応結果
-- response_note: 判断メモ
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
ADD COLUMN IF NOT EXISTS response_status anomaly_response_status,
ADD COLUMN IF NOT EXISTS response_note text;

-- 3. Update Tamper Protection Trigger (prevent_audit_log_tampering)
-- Allow updates ONLY to the status/response columns.
-- EVERYTHING ELSE IS IMMUTABLE.

CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for modification of Immutable Columns
    -- If any column other than the allowed ones changes, raise exception.
    IF (OLD.id IS DISTINCT FROM NEW.id) OR
       (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) OR
       (OLD.actor_auth_id IS DISTINCT FROM NEW.actor_auth_id) OR
       (OLD.actor_name IS DISTINCT FROM NEW.actor_name) OR
       (OLD.actor_employee_code IS DISTINCT FROM NEW.actor_employee_code) OR
       (OLD.action_type IS DISTINCT FROM NEW.action_type) OR
       (OLD.target_type IS DISTINCT FROM NEW.target_type) OR
       (OLD.target_id IS DISTINCT FROM NEW.target_id) OR
       (OLD.ip_address IS DISTINCT FROM NEW.ip_address) OR
       (OLD.metadata IS DISTINCT FROM NEW.metadata) OR
       (OLD.severity IS DISTINCT FROM NEW.severity) THEN
        
        RAISE EXCEPTION 'Audit logs are immutable. Only response/status columns (is_acknowledged, acknowledged_by, acknowledged_at, response_status, response_note, is_archived, archived_at) can be updated.';
    END IF;

    -- Note: is_acknowledged, acknowledged_by, acknowledged_at, response_status, response_note, is_archived, archived_at
    -- these are NOT checked above, so they can be changed.

    RETURN NEW;
END;
$$;
