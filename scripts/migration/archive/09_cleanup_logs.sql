-- Phase 4-3: Data Cleanup Policy
-- Function to delete old audit logs
-- Retention Policy:
-- 1. Standard Logs: Keep for 90 days
-- 2. Anomaly Logs (ANOMALY_DETECTED): Keep Indefinitely (or longer)
-- 3. Reports: Keep Daily for 1 year, Weekly Indefinitely

create or replace function cleanup_old_audit_logs(retention_days int default 90)
returns void
language plpgsql
security definer
as $$
declare
    deleted_count int;
begin
    -- Delete standard logs older than retention_days
    -- Exclude 'ANOMALY_DETECTED' to preserve security incidents history
    delete from audit_logs
    where occurred_at < (now() - (retention_days || ' days')::interval)
      and action_type != 'ANOMALY_DETECTED';

    get diagnostics deleted_count = row_count;

    -- Log the cleanup action itself (Self-Auditing)
    -- We insert this directly to avoid circular dependency with application logic if possible,
    -- or just rely on the fact that this function is called by system.
    -- However, audit_logs might have just been cleaned, so inserting a new one is fine.
    insert into audit_logs (
        action_type,
        target_type,
        details,
        actor_name,
        result,
        metadata
    ) values (
        'SYSTEM_CLEANUP',
        'system',
        'Old audit logs cleaned up automatically.',
        'System Cron',
        'success',
        jsonb_build_object('retention_days', retention_days, 'deleted_count', deleted_count)
    );
end;
$$;

-- Schedule Cleanup Job (Monthly)
-- Runs at 03:00 UTC on the 1st of every month
-- NOTE: Enable if you want auto-deletion.
/*
select cron.schedule(
    'monthly-log-cleanup',
    '0 3 1 * *',
    $$select cleanup_old_audit_logs(90);$$
);
*/
