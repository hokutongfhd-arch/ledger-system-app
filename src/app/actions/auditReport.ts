'use server';

import { createClient } from '@supabase/supabase-js';
import { sendSlackAlert } from './slack';

// Initialize Supabase Admin Client for Server Actions
// using Service Role Key if available for background tasks, typically.
// However, since we are calling this potentially from a cron or authenticated context...
// If this is a CRON job, we need to bypass RLS or use the service role.
// Assuming we can use the standard client setup or environment variables directly here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// If Service Key is unavailable, might fail RLS if not authenticated.
// For Cron, we usually need Service Key.

export async function sendDailyAuditReportToSlack() {
    if (!supabaseServiceKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Cannot fetch reports for cron.');
        return { success: false, error: 'Configuration Error' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Fetch the latest daily report
        const { data: reports, error } = await supabase
            .from('audit_reports')
            .select('*')
            .eq('report_type', 'daily')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        if (!reports || reports.length === 0) {
            console.log('No daily audit report found to send.');
            return { success: false, message: 'No report found' };
        }

        const report = reports[0];
        const summary = report.summary;

        // Format the message
        let message = `*📊 Daily Audit Report (${new Date(report.period_start).toLocaleDateString()})*\n\n`;
        message += `• *Total Actions:* ${summary.total_actions}\n`;
        message += `• *Login Failures:* ${summary.login_failures} ${summary.login_failures > 0 ? '⚠️' : '✅'}\n`;
        message += `• *Anomalies:* ${summary.anomalies} ${summary.anomalies > 0 ? '🚨' : '✅'}\n`;

        message += `\n*🔍 Breakdown by Action*\n`;
        const actionKeys = Object.keys(summary.breakdown_by_action || {});
        if (actionKeys.length > 0) {
            actionKeys.forEach(key => {
                message += `- ${key}: ${summary.breakdown_by_action[key]}\n`;
            });
        } else {
            message += `(No actions recorded)\n`;
        }

        // Send to Slack
        // We reuse the existing alert system but wrap it slightly or just call it directly.
        // Since sendSlackAlert extracts "context" into blocks, we can pass summary as context too
        // but the message above is already pre-formatted. 
        // Let's pass the message as the "message" argument and maybe raw summary as context.

        await sendSlackAlert(
            'Daily Audit Summary',
            message,
            {
                period_start: report.period_start,
                period_end: report.period_end,
                generated_at: report.created_at
            }
        );

        return { success: true };

    } catch (err: any) {
        console.error('Failed to send daily audit report to Slack:', err);
        return { success: false, error: err.message };
    }
}
