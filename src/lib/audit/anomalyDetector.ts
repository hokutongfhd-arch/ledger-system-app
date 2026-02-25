import type { Log } from '../types';
import type { AnomalyEvent } from '../types/audit';
import type { AnomalyRule } from '../../features/audit/audit.service';

/**
 * Detects anomalies in a given set of recent logs based on dynamic rules.
 * @param recentLogs Logs from the last N minutes to analyze
 * @param rules Configuration for anomaly detection
 */
export function detectAnomaly(recentLogs: Log[], rules: AnomalyRule[]): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const now = new Date();

    // Helper to get rule by key
    const getRule = (key: string) => rules.find(r => r.rule_key === key);

    // 1. MULTIPLE_FAILED_LOGINS Check
    const loginFailRule = getRule('MULTIPLE_FAILED_LOGINS');
    if (loginFailRule?.enabled) {
        const threshold = loginFailRule.params.threshold || 5;
        // Note: window_minutes is used by useAnomalyMonitor to fetch the logs, 
        // but we can also double check here if needed.

        const loginFailures = recentLogs.filter(log => log.actionRaw === 'LOGIN_FAILURE');
        const failuresByEmployee = loginFailures.reduce((acc, log) => {
            const key = log.actorEmployeeCode || 'unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(log);
            return acc;
        }, {} as Record<string, Log[]>);

        Object.entries(failuresByEmployee).forEach(([employeeCode, logs]) => {
            if (logs.length >= threshold) {
                anomalies.push({
                    type: 'LOGIN_BRUTE_FORCE', // Keep internal type or change to MULTIPLE_FAILED_LOGINS
                    description: `同一社員(${employeeCode})による連続ログイン失敗を検知しました (${logs.length}回 / 設定しきい値: ${threshold}回)`,
                    detectedAt: now.toISOString(),
                    relatedLogIds: logs.map(l => l.id),
                    riskLevel: loginFailRule.severity
                });
            }
        });
    }

    // 2. AFTER_HOURS_ACCESS Check
    const afterHoursRule = getRule('AFTER_HOURS_ACCESS');
    if (afterHoursRule?.enabled) {
        const startTime = afterHoursRule.params.start; // HH:mm
        const endTime = afterHoursRule.params.end;     // HH:mm

        if (startTime && endTime) {
            recentLogs.forEach(log => {
                // Skip if not a sensitive action (optional, for now check all)
                const logTime = new Date(log.timestamp);
                const hours = logTime.getHours();
                const minutes = logTime.getMinutes();
                const currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

                // Simple check (doesn't handle overnight window well, but following current UI pattern)
                const isAfterHours = currentTimeStr >= startTime || currentTimeStr <= endTime;

                if (isAfterHours && log.actionRaw !== 'LOGIN_FAILURE') {
                    anomalies.push({
                        type: 'SUSPICIOUS_ACCESS',
                        description: `時間外アクセスを検知しました (${currentTimeStr} / 許可時間: ${endTime}-${startTime})`,
                        detectedAt: now.toISOString(),
                        relatedLogIds: [log.id],
                        riskLevel: afterHoursRule.severity
                    });
                }
            });
        }
    }

    // 3. BULK_UPDATE Check (Optional: might not be in DB yet, but keep logic if exists)
    const bulkUpdateRule = getRule('BULK_UPDATE');
    if (bulkUpdateRule?.enabled) {
        const threshold = bulkUpdateRule.params.threshold || 10;
        const updates = recentLogs.filter(log => ['UPDATE', 'DELETE'].includes(log.actionRaw));

        if (updates.length >= threshold) {
            anomalies.push({
                type: 'BULK_UPDATE',
                description: `短時間での大量データ変更を検知しました (${updates.length}件 / しきい値: ${threshold}件)`,
                detectedAt: now.toISOString(),
                relatedLogIds: updates.map(l => l.id),
                riskLevel: bulkUpdateRule.severity
            });
        }
    }

    return anomalies;
}
