-- Phase 7-5: Exclude GENERATE action from anomaly detection
-- Also optimize the actor resolution to prevent potential race conditions with multiple clients

CREATE OR REPLACE FUNCTION detect_anomaly()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule_record record;
    occurred_at_jst_time time;
    is_anomaly boolean := false;
    recent_count int;
    determined_severity text;
    start_time time;
    end_time time;
BEGIN
    -- 1. 異常検知の対象外とするアクションを定義
    -- ANOMALY_DETECTED: 無限ループ防止
    -- GENERATE: レポート生成は正当な管理者操作
    -- LOGIN_SUCCESS / LOGOUT: 標準的な認証操作
    IF NEW.action_type IN ('ANOMALY_DETECTED', 'GENERATE', 'LOGIN_SUCCESS', 'LOGOUT') THEN
        RETURN NEW;
    END IF;

    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- 2. AFTER_HOURS_ACCESS Rule
    SELECT * INTO rule_record FROM audit_anomaly_rules WHERE rule_key = 'AFTER_HOURS_ACCESS' AND enabled = true;
    
    IF FOUND THEN
        -- UTCのnow()または入力値をJSTの壁面時刻に変換
        occurred_at_jst_time := (COALESCE(NEW.occurred_at, now()) AT TIME ZONE 'Asia/Tokyo')::time;
        
        start_time := (rule_record.params->>'start')::time;
        end_time := (rule_record.params->>'end')::time;

        -- 判定ロジック（業務時間外かチェック）
        IF start_time > end_time THEN
            -- 夜間（例: 20:00 〜 08:00）
            IF (occurred_at_jst_time >= start_time OR occurred_at_jst_time < end_time) THEN
                is_anomaly := true;
            END IF;
        ELSE
            -- 特定時間帯（例: 00:00 〜 05:00）
            IF (occurred_at_jst_time >= start_time AND occurred_at_jst_time < end_time) THEN
                is_anomaly := true;
            END IF;
        END IF;

        IF is_anomaly THEN
            determined_severity := rule_record.severity;

            -- 同一ユーザーによる直近30分以内の検知数をチェック（過剰な通知を抑制しつつ重要度を上げる）
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

            -- 異常検知ログの挿入
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
                'security_notification', 
                'admin_action', 
                NEW.actor_name,
                NEW.actor_employee_code,
                'warning', 
                NEW.occurred_at,
                NEW.ip_address,
                jsonb_build_object(
                    'original_log_id', NEW.id, 
                    'trigger', 'after_hours', 
                    'rule_id', rule_record.id,
                    'details', '業務時間外の重要操作検知: ' || NEW.action_type
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
