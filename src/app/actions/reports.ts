'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { AuditReport, Log } from '@/lib/types';
import { startOfDay, endOfDay } from 'date-fns';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Role を使用して全データを取得（監査用）
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function fetchAuditReportData(startDate: string, endDate: string) {
    try {
        // 1. 範囲内の全監査ログを取得
        const { data: logs, error: logsError } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .gte('occurred_at', startDate)
            .lte('occurred_at', endDate)
            .order('occurred_at', { ascending: true });

        if (logsError) throw logsError;

        // 2. 統計の集計
        const anomalies = logs.filter(l => l.action_type === 'ANOMALY_DETECTED');
        const breakdown_by_action: Record<string, number> = {};
        const breakdown_by_result: Record<string, number> = {};

        logs.forEach(l => {
            breakdown_by_action[l.action_type] = (breakdown_by_action[l.action_type] || 0) + 1;
            breakdown_by_result[l.result] = (breakdown_by_result[l.result] || 0) + 1;
        });

        const summaryData = {
            total_actions: logs.length,
            login_failures: logs.filter(l => l.action_type === 'LOGIN_FAILURE').length,
            anomalies: anomalies.length,
            unacknowledged_anomalies: anomalies.filter(l => !l.is_acknowledged).length,
            breakdown_by_action,
            breakdown_by_result,
            generated_at: new Date().toISOString()
        };

        // 3. 不正ログの詳細（対応メモ含む）を別途整形
        const anomalyDetails = anomalies.map(a => ({
            id: a.id,
            timestamp: a.occurred_at,
            actor: a.actor_name,
            actorCode: a.actor_employee_code,
            action: a.action_type,
            target: a.target_type,
            severity: a.severity,
            status: a.response_status || (a.is_acknowledged ? 'completed' : 'pending'),
            responseNote: a.response_note,
            acknowledged_at: a.acknowledged_at,
            acknowledged_by: a.acknowledged_by
        }));

        return {
            success: true,
            summary: summaryData,
            anomalies: anomalyDetails,
            period: { start: startDate, end: endDate }
        };

    } catch (err: any) {
        console.error('Failed to fetch report data:', err);
        return { success: false, error: err.message };
    }
}

/**
 * レポート生成操作を記録し、履歴をDBに保存する
 */
export async function saveAuditReportHistory(report: Partial<AuditReport>) {
    try {
        const { data, error } = await supabaseAdmin
            .from('audit_reports')
            .insert([{
                ...report,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // 操作ログに記録
        await supabaseAdmin.from('logs').insert([{
            table_name: 'audit_reports',
            operation: 'INSERT',
            action: 'report_generate',
            target: `REPORT: ${report.report_type}`,
            new_data: report,
            actor_name: report.generated_by_name || 'SYSTEM',
            actor_code: report.generated_by || 'SYSTEM',
            occurred_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        }]);

        return { success: true, report: data };
    } catch (err: any) {
        console.error('Failed to save report history:', err);
        return { success: false, error: err.message };
    }
}
