-- Phase 6-4: Anomaly Severity Management

-- 1. Add 'severity' column
-- Allowed values: low, medium, high, critical
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'low'
CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- 2. Update Anomaly Detection Logic (detect_after_hours_anomaly)
-- Logic Upgrade: 
--   - Default Anomaly -> 'medium' (e.g. single after-hours access)
--   - Recurring Anomaly (Same User in last 30 mins) -> 'high'
--   - (Critical is reserved for future use)

CREATE OR REPLACE FUNCTION detect_after_hours_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    occurred_at_jst timestamptz;
    hour_jst int;
    recent_count int;
    determined_severity text;
BEGIN
    -- Prevent infinite loops
    IF NEW.action_type = 'ANOMALY_DETECTED' THEN
        RETURN NEW;
    END IF;

    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Timezone Check (JST)
    occurred_at_jst := (COALESCE(NEW.occurred_at, now()) AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo';
    hour_jst := EXTRACT(HOUR FROM occurred_at_jst);

    -- Business Hours Check (20:00 - 08:00 is Anomaly)
    IF hour_jst < 8 OR hour_jst >= 20 THEN
        
        -- Severity Logic: Check frequency
        SELECT COUNT(*) INTO recent_count
        FROM audit_logs
        WHERE action_type = 'ANOMALY_DETECTED'
          AND actor_employee_code = NEW.actor_employee_code
          AND occurred_at > (now() - interval '30 minutes');

        IF recent_count > 0 THEN
            determined_severity := 'high';
        ELSE
            determined_severity := 'medium';
        END IF;

        -- Insert Anomaly Log
        INSERT INTO audit_logs (
            action_type,
            target_type,
            target_id,
            -- details,  <-- Removed
            actor_name,
            actor_employee_code,
            result,
            occurred_at,
            ip_address,
            metadata,
            is_archived,
            is_acknowledged,
            severity
        ) VALUES (
            'ANOMALY_DETECTED',
            'after_hours_access', 
            'security', 
            -- 'After-hours access detected: ' || NEW.action_type, 
            NEW.actor_name,
            NEW.actor_employee_code,
            'warning', 
            NEW.occurred_at,
            NEW.ip_address,
            jsonb_build_object('original_log_id', NEW.id, 'trigger', 'after_hours', 'details', 'After-hours access detected: ' || NEW.action_type), -- Moved to metadata
            false,
            false,
            determined_severity
        );
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Update Tamper Protection Trigger (prevent_audit_log_tampering)
-- Ensure 'severity' cannot be UPDATED. Only 'is_acknowledged' and 'is_archived'.

CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check for modification of Immutable Columns
    -- ANY change to these columns raises an exception
    IF (OLD.id IS DISTINCT FROM NEW.id) OR
       (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) OR
       (OLD.actor_id IS DISTINCT FROM NEW.actor_id) OR
       (OLD.actor_name IS DISTINCT FROM NEW.actor_name) OR
       (OLD.actor_employee_code IS DISTINCT FROM NEW.actor_employee_code) OR
       (OLD.action_type IS DISTINCT FROM NEW.action_type) OR
       (OLD.target_type IS DISTINCT FROM NEW.target_type) OR
       (OLD.target_id IS DISTINCT FROM NEW.target_id) OR
       -- (OLD.details IS DISTINCT FROM NEW.details) OR <-- Removed
       (OLD.result IS DISTINCT FROM NEW.result) OR
       (OLD.ip_address IS DISTINCT FROM NEW.ip_address) OR
       (OLD.metadata IS DISTINCT FROM NEW.metadata) OR
       (OLD.severity IS DISTINCT FROM NEW.severity) THEN -- Severity is IMMUTABLE
        
        RAISE EXCEPTION 'Audit logs are immutable. Only "is_archived", "archived_at", and "is_acknowledged" can be updated.';
    END IF;

    -- If we get here, only permitted columns (status flags) might have changed.
    RETURN NEW;
END;
$$;
