-- fix_audit_trigger_schema.sql
-- 監査ログの改ざん防止トリガーから、存在しないカラム「actor_id」への参照を削除します。

CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 以下のカラムが変更された場合はエラーを投げる（不変カラムの保護）
    IF (OLD.id IS DISTINCT FROM NEW.id) OR
       (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) OR
       (OLD.actor_name IS DISTINCT FROM NEW.actor_name) OR
       (OLD.actor_employee_code IS DISTINCT FROM NEW.actor_employee_code) OR
       (OLD.action_type IS DISTINCT FROM NEW.action_type) OR
       (OLD.target_type IS DISTINCT FROM NEW.target_type) OR
       (OLD.target_id IS DISTINCT FROM NEW.target_id) OR
       (OLD.result IS DISTINCT FROM NEW.result) OR
       (OLD.ip_address IS DISTINCT FROM NEW.ip_address) OR
       (OLD.metadata IS DISTINCT FROM NEW.metadata) OR
       (OLD.severity IS DISTINCT FROM NEW.severity) THEN
        
        RAISE EXCEPTION 'Audit logs are immutable. Only "is_archived", "archived_at", and "is_acknowledged" can be updated.';
    END IF;

    -- 許可されたカラム（既読フラグ、アーカイブフラグ等）の変更は許可
    RETURN NEW;
END;
$$;
