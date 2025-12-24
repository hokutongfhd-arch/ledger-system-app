-- Phase 6-5: Anomaly Rule Management UI

-- 1. Create audit_anomaly_rules table
CREATE TABLE IF NOT EXISTS audit_anomaly_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text UNIQUE NOT NULL,          -- e.g. AFTER_HOURS_ACCESS
  description text,
  enabled boolean DEFAULT true,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  params jsonb NOT NULL,                  -- { "start": "20:00", "end": "08:00" }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Set up RLS
ALTER TABLE audit_anomaly_rules ENABLE ROW LEVEL SECURITY;

-- Admin: Full Access
CREATE POLICY admin_all_anomaly_rules ON audit_anomaly_rules
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employee_code = auth.jwt() ->> 'email' -- Assuming email/code mapping
    AND authority = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employee_code = auth.jwt() ->> 'email'
    AND authority = 'admin'
  )
);

-- Note: Handle 'anon' if necessary, but rules should be admin-only.
-- Since the app uses a custom AuthContext/session, 
-- ensure the RLS matches the existing patterns (often based on anon/authenticated roles).
-- Looking at previous SQLs, they often grant to anon/authenticated.

GRANT SELECT, UPDATE ON audit_anomaly_rules TO authenticated, anon;

-- 3. Initial Data
INSERT INTO audit_anomaly_rules (rule_key, description, enabled, severity, params)
VALUES (
  'AFTER_HOURS_ACCESS',
  '業務時間外（夜間・早朝）のアクセスを検知します。',
  true,
  'medium',
  '{"start": "20:00", "end": "08:00"}'::jsonb
)
ON CONFLICT (rule_key) DO UPDATE SET
  description = EXCLUDED.description,
  params = EXCLUDED.params;

-- 4. Update Anomaly Detection Function (detect_anomaly)
-- Renaming and making it config-driven.

CREATE OR REPLACE FUNCTION detect_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule_record record;
    occurred_at_jst timestamptz;
    hour_jst int;
    start_time time;
    end_time time;
    is_anomaly boolean := false;
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

    -- 1. AFTER_HOURS_ACCESS Rule
    SELECT * INTO rule_record FROM audit_anomaly_rules WHERE rule_key = 'AFTER_HOURS_ACCESS' AND enabled = true;
    
    IF FOUND THEN
        occurred_at_jst := (COALESCE(NEW.occurred_at, now()) AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo';
        hour_jst := EXTRACT(HOUR FROM occurred_at_jst);
        
        start_time := (rule_record.params->>'start')::time;
        end_time := (rule_record.params->>'end')::time;

        -- Check if current hour is within anomaly range
        -- If start > end (e.g. 20:00 to 08:00), anomaly is hour >= start OR hour < end
        IF start_time > end_time THEN
            IF (occurred_at_jst::time >= start_time OR occurred_at_jst::time < end_time) THEN
                is_anomaly := true;
            END IF;
        ELSE
            -- Normal range (e.g. 00:00 to 05:00)
            IF (occurred_at_jst::time >= start_time AND occurred_at_jst::time < end_time) THEN
                is_anomaly := true;
            END IF;
        END IF;

        IF is_anomaly THEN
            -- Severity Logic: Default to rule severity, increase if recurring
            determined_severity := rule_record.severity;

            -- Check frequency for same user in last 30 mins
            SELECT COUNT(*) INTO recent_count
            FROM audit_logs
            WHERE action_type = 'ANOMALY_DETECTED'
              AND actor_employee_code = NEW.actor_employee_code
              AND occurred_at > (now() - interval '30 minutes');

            IF recent_count > 0 THEN
                -- If recurring, bump severity (medium -> high)
                IF determined_severity = 'medium' THEN
                    determined_severity := 'high';
                ELSIF determined_severity = 'low' THEN
                    determined_severity := 'medium';
                END IF;
            END IF;

            -- Insert Anomaly Log
            INSERT INTO audit_logs (
                action_type,
                target_type,
                target_id,
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
                NEW.actor_name,
                NEW.actor_employee_code,
                'warning', 
                NEW.occurred_at,
                NEW.ip_address,
                jsonb_build_object(
                    'original_log_id', NEW.id, 
                    'trigger', 'after_hours', 
                    'rule_id', rule_record.id,
                    'details', 'After-hours access detected: ' || NEW.action_type
                ),
                false,
                false,
                determined_severity
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 5. Re-bind Trigger
DROP TRIGGER IF EXISTS trg_detect_after_hours_anomaly ON audit_logs;
DROP TRIGGER IF EXISTS trg_detect_anomaly ON audit_logs;

CREATE TRIGGER trg_detect_anomaly
AFTER INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION detect_anomaly();
