-- Phase 4-2: Automated Audit Reports & pg_cron
-- 1. Create audit_reports table
create table if not exists audit_reports (
  id uuid default gen_random_uuid() primary key,
  report_type text not null check (report_type in ('daily', 'weekly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  summary jsonb not null,
  created_at timestamptz default now()
);

-- 2. Enable RLS and Policy
alter table audit_reports enable row level security;

create policy "Admins can view audit reports"
on audit_reports
for select
using (
  exists (
    select 1
    from employees
    where auth_id = auth.uid()
      and authority = 'admin'
  )
);

-- 3. Create Daily Report Generation Function
-- target_date: The date to generate the report for.
-- Aggregates logs from target_date 00:00 UTC to 23:59:59 UTC.
create or replace function generate_daily_audit_report(target_date date)
returns void
language plpgsql
security definer
as $$
declare
    t_start timestamptz;
    t_end timestamptz;
    summary_json jsonb;
    total_actions int;
    login_failures int;
    anomalies int;
    action_breakdown jsonb;
    result_breakdown jsonb;
begin
    -- Define period (UTC day based on input date)
    t_start := target_date::timestamptz;
    t_end   := t_start + interval '1 day' - interval '1 second';
    
    -- Aggregate Data
    select count(*) into total_actions 
    from audit_logs 
    where occurred_at between t_start and t_end;

    select count(*) into login_failures
    from audit_logs 
    where occurred_at between t_start and t_end
      and action_type = 'LOGIN_FAILURE';

    select count(*) into anomalies
    from audit_logs 
    where occurred_at between t_start and t_end
      and action_type = 'ANOMALY_DETECTED';

    -- Breakdown by Action
    select jsonb_object_agg(action_type, count) into action_breakdown
    from (
        select action_type, count(*) as count
        from audit_logs
        where occurred_at between t_start and t_end
        group by action_type
    ) sub;
    
    if action_breakdown is null then
        action_breakdown := '{}'::jsonb;
    end if;

    -- Breakdown by Result
    select jsonb_object_agg(result, count) into result_breakdown
    from (
        select result, count(*) as count
        from audit_logs
        where occurred_at between t_start and t_end
        group by result
    ) sub;
    
    if result_breakdown is null then
        result_breakdown := '{}'::jsonb;
    end if;

    -- Construct Summary JSON
    summary_json := jsonb_build_object(
        'total_actions', coalesce(total_actions, 0),
        'login_failures', coalesce(login_failures, 0),
        'anomalies', coalesce(anomalies, 0),
        'breakdown_by_action', action_breakdown,
        'breakdown_by_result', result_breakdown,
        'generated_at', now()
    );

    -- Insert Report
    insert into audit_reports (
        report_type,
        period_start,
        period_end,
        summary
    ) values (
        'daily',
        t_start,
        t_end,
        summary_json
    );

exception when others then
    -- Fail safe: Log error but ensure function finishes without crashing the scheduler if possible
    raise warning 'Failed to generate daily audit report: %', SQLERRM;
end;
$$;

-- 4. Schedule pg_cron
-- Safe unschedule: Loop through existing jobs with the name and unschedule by ID
-- This avoids "job not found" errors on fresh installs
DO $$
DECLARE
    jid bigint;
BEGIN
    FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'daily-audit-report' LOOP
        PERFORM cron.unschedule(jid);
    END LOOP;
END
$$;

-- Schedule the job to run every day at 00:00 UTC (09:00 JST)
-- It generates the report for the "Previous Day"
select cron.schedule(
    'daily-audit-report',
    '0 0 * * *',
    $$select generate_daily_audit_report(current_date - interval '1 day');$$
);
