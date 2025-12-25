-- Phase 6-9: Fix Anomaly Timezone Misinterpretation

CREATE OR REPLACE FUNCTION detect_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule_record record;
    occurred_at_jst_time time; -- JSTの壁面時刻（時間のみ）
    is_anomaly boolean := false;
    recent_count int;
    determined_severity text;
    start_time time;
    end_time time;
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
        -- Correct way to get JST time from timestamptz:
        -- Use AT TIME ZONE to get a 'timestamp without time zone' in the target zone.
        -- This represents the local clock time.
        occurred_at_jst_time := (COALESCE(NEW.occurred_at, now()) AT TIME ZONE 'Asia/Tokyo')::time;
        
        start_time := (rule_record.params->>'start')::time;
        end_time := (rule_record.params->>'end')::time;

        -- Check if current time is within anomaly range
        -- If start > end (e.g. 20:00 to 08:00), anomaly is time >= start OR time < end
        IF start_time > end_time THEN
            IF (occurred_at_jst_time >= start_time OR occurred_at_jst_time < end_time) THEN
                is_anomaly := true;
            END IF;
        ELSE
            -- Normal range (e.g. 00:00 to 05:00)
            IF (occurred_at_jst_time >= start_time AND occurred_at_jst_time < end_time) THEN
                is_anomaly := true;
            END IF;
        END IF;

        IF is_anomaly THEN
            -- Severity Logic
            determined_severity := rule_record.severity;

            -- Check frequency for same user in last 30 mins
            SELECT COUNT(*) INTO recent_count
            FROM audit_logs
            WHERE action_type = 'ANOMALY_DETECTED'
              AND actor_employee_code = NEW.actor_employee_code
              AND occurred_at > (now() - interval '30 minutes');

            IF recent_count > 0 THEN
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
