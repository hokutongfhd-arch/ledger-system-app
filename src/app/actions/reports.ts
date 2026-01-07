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

        // Trend aggregation
        const trendMap = new Map<string, { count: number; failureCount: number; anomalyCount: number }>();
        // Distribution aggregation
        const actionMap = new Map<string, number>();
        // Top actors aggregation
        const actorMap = new Map<string, { count: number; name: string }>();
        const anomalyActorMap = new Map<string, { count: number; name: string }>();

        logs.forEach(l => {
            // Summary breakdown
            breakdown_by_action[l.action_type] = (breakdown_by_action[l.action_type] || 0) + 1;
            breakdown_by_result[l.result] = (breakdown_by_result[l.result] || 0) + 1;

            // Trend
            const day = l.occurred_at.split('T')[0];
            const currentTrend = trendMap.get(day) || { count: 0, failureCount: 0, anomalyCount: 0 };
            currentTrend.count++;
            if (l.result === 'failure') currentTrend.failureCount++;
            if (l.action_type === 'ANOMALY_DETECTED') currentTrend.anomalyCount++;
            trendMap.set(day, currentTrend);

            // Distribution
            actionMap.set(l.action_type, (actionMap.get(l.action_type) || 0) + 1);

            // Top actors
            const code = l.actor_employee_code;
            const name = l.actor_name;
            if (code) {
                const currentActor = actorMap.get(code) || { count: 0, name };
                currentActor.count++;
                actorMap.set(code, currentActor);

                if (l.action_type === 'ANOMALY_DETECTED') {
                    const currentAnomalyActor = anomalyActorMap.get(code) || { count: 0, name };
                    currentAnomalyActor.count++;
                    anomalyActorMap.set(code, currentAnomalyActor);
                }
            }
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

        // Format chart data
        const trend = Array.from(trendMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const ACTION_COLOR_MAP: Record<string, string> = {
            LOGIN_SUCCESS: '#0088FE',
            ANOMALY_DETECTED: '#FF6B6B',
            CREATE: '#FF8042',
            UPDATE: '#00C49F',
            DELETE: '#8884d8',
            LOGOUT: '#82ca9d'
        };
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

        const distribution = Array.from(actionMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([action, count], index) => ({
                action,
                count,
                fill: ACTION_COLOR_MAP[action] || COLORS[index % COLORS.length]
            }));

        const topActors = Array.from(actorMap.entries())
            .map(([code, stats]) => ({ code, ...stats }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const topAnomalyActors = Array.from(anomalyActorMap.entries())
            .map(([code, stats]) => ({ code, ...stats }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

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
            trend,
            distribution,
            topActors,
            topAnomalyActors,
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

        // 監査ログに記録 (操作ログ 'logs' ではなく 'audit_logs')
        await supabaseAdmin.from('audit_logs').insert([{
            action_type: 'GENERATE',
            target_type: 'report',
            target_id: data.id,
            result: 'success',
            actor_employee_code: report.generated_by || 'SYSTEM',
            actor_name: report.generated_by_name || 'SYSTEM',
            occurred_at: new Date().toISOString(),
            metadata: {
                report_type: report.report_type,
                period_start: report.period_start,
                period_end: report.period_end,
                message: `監査レポート生成: ${report.report_type}`
            }
        }]);

        return { success: true, report: data };
    } catch (err: any) {
        console.error('Failed to save report history:', err);
        return { success: false, error: err.message };
    }
}
