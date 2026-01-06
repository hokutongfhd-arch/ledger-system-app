-- Phase 6-2: Anomaly Detection (After-Hours Access)
-- corrected version: removed 'target' column, using 'target_type'

-- 1. Create Function to Detect After-Hours Access
CREATE OR REPLACE FUNCTION detect_after_hours_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    occurred_at_jst timestamptz;
    hour_jst int;
BEGIN
    -- Prevent infinite loops: Do not process if the action is already an anomaly detection
    IF NEW.action_type = 'ANOMALY_DETECTED' THEN
        RETURN NEW;
    END IF;

    -- Limit recursion depth just in case
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Convert occurred_at (or created_at) to JST
    occurred_at_jst := (COALESCE(NEW.occurred_at, now()) AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo';
    hour_jst := EXTRACT(HOUR FROM occurred_at_jst);

    -- Check if outside business hours (08:00 - 20:00)
    -- Business hours: 08:00 <= hour < 20:00
    IF hour_jst < 8 OR hour_jst >= 20 THEN
        -- Insert Anomaly Log
        -- Note: Removed 'target' column as it likely does not exist. Using 'target_type' and 'target_id'.
        INSERT INTO audit_logs (
            action_type,
            target_type,    -- Correct column name
            target_id,      -- Added target_id just in case
            details,
            actor_name,
            actor_employee_code,
            result,
            occurred_at,
            ip_address,
            metadata,
            is_archived
        ) VALUES (
            'ANOMALY_DETECTED',
            'after_hours_access', -- target_type
            'security',           -- target_id (placeholder)
            'After-hours access detected: ' || NEW.action_type, -- details
            NEW.actor_name,
            NEW.actor_employee_code,
            'warning',           -- result
            NEW.occurred_at,
            NEW.ip_address,
            jsonb_build_object('original_log_id', NEW.id, 'trigger', 'after_hours'),
            false
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trg_detect_after_hours_anomaly ON audit_logs;

CREATE TRIGGER trg_detect_after_hours_anomaly
AFTER INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION detect_after_hours_anomaly();
