-- Phase 6-3: Anomaly Notification (Slack via pg_net)

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Create Notification Function
CREATE OR REPLACE FUNCTION notify_anomaly_to_slack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    webhook_url text;
    payload jsonb;
    response_id uuid;
BEGIN
    -- Strict Condition: Only notify for ANOMALY_DETECTED
    IF NEW.action_type <> 'ANOMALY_DETECTED' THEN
        RETURN NEW;
    END IF;

    -- 2.1 Fetch Webhook URL from Supabase Vault
    -- NOTE: User must set this secret! 
    -- Run: select vault.create_secret('https://hooks.slack.com/...', 'SLACK_WEBHOOK_URL');
    SELECT decrypted_secret INTO webhook_url
    FROM vault.decrypted_secrets
    WHERE name = 'SLACK_WEBHOOK_URL'
    LIMIT 1;

    -- Fallback/Safety: If no URL found, log to console (or just exit) to prevent errors
    -- In a real scenario, you might hardcode a URL for testing:
    -- webhook_url := 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'; 
    
    IF webhook_url IS NULL THEN
        -- Optionally RAISE NOTICE 'Slack Webhook URL not found in Vault';
        RETURN NEW; -- Do not fail the transaction
    END IF;

    -- 2.2 Construct Payload
    payload := jsonb_build_object(
        'text', format(
            '🚨 *Serious Anomaly Detected* 🚨%s' ||
            '*Type:* %s%s' ||
            '*Severity:* HIGH%s' ||
            '*Source:* db-trigger%s' ||
            '*User:* %s (%s)%s' ||
            '*Time:* %s%s' ||
            '*Details:* %s',
            E'\n\n',
            NEW.target_type, E'\n',
            E'\n',
            E'\n',
            NEW.actor_name, NEW.actor_employee_code, E'\n',
            NEW.occurred_at, E'\n',
            NEW.details
        )
    );

    -- 2.3 Send Request (Fire and Forget)
    -- We use PERFORM to discard the result. 
    -- pg_net is asynchronous, so this queues the request.
    BEGIN
        PERFORM net.http_post(
            url := webhook_url,
            body := payload,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
    EXCEPTION WHEN OTHERS THEN
        -- SAFETY: Never break the INSERT transaction even if networking/queuing fails
        -- RAISE WARNING 'Failed to queue Slack notification: %', SQLERRM;
        NULL;
    END;

    -- 2.4 Return NEW to allow the INSERT to proceed
    RETURN NEW;
END;
$$;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trg_notify_anomaly_to_slack ON audit_logs;

CREATE TRIGGER trg_notify_anomaly_to_slack
AFTER INSERT ON audit_logs
FOR EACH ROW
WHEN (NEW.action_type = 'ANOMALY_DETECTED')
EXECUTE FUNCTION notify_anomaly_to_slack();
