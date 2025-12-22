
import type { Log } from '../types';
import type { AnomalyEvent, AnomalyType } from '../types/audit';

const RULES = {
    LOGIN_BRUTE_FORCE: {
        windowSeconds: 600, // 10 minutes
        threshold: 5
    },
    BULK_UPDATE: {
        windowSeconds: 60, // 1 minute
        threshold: 10
    }
};

/**
 * Detects anomalies in a given set of recent logs.
 * This function is pure and side-effect free.
 * @param recentLogs Logs from the last N minutes to analyze
 */
export function detectAnomaly(recentLogs: Log[]): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];
    const now = new Date();

    // 1. LOGIN_BRUTE_FORCE Check
    // Group login failures by employee code
    const loginFailures = recentLogs.filter(
        log => log.actionRaw === 'LOGIN_FAILURE'
    );

    const failuresByEmployee = loginFailures.reduce((acc, log) => {
        const key = log.actorEmployeeCode || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(log);
        return acc;
    }, {} as Record<string, Log[]>);

    Object.entries(failuresByEmployee).forEach(([employeeCode, logs]) => {
        // Sort by time just in case
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Count failures within the window
        // For simplicity in this "snapshot" check, we just check if count > threshold in the provided list
        // assuming the provided list IS the window.
        // But to be more robust, we should check sliding window if list is long.
        // Here we assume recentLogs are already filtered to a reasonable recent timeframe (e.g. last 10-15 mins).

        if (logs.length >= RULES.LOGIN_BRUTE_FORCE.threshold) {
            anomalies.push({
                type: 'LOGIN_BRUTE_FORCE',
                description: `同一社員(${employeeCode})による連続ログイン失敗を検知しました (${logs.length}回)`,
                detectedAt: now.toISOString(),
                relatedLogIds: logs.map(l => l.id),
                riskLevel: 'high'
            });
        }
    });

    // 2. UNAUTHORIZED_ACTION Check
    // If a non-admin user performs an admin action (needs definition of 'admin action')
    // This is tricky without knowing user roles from logs explicitly if not stored.
    // Assuming 'system' or 'user' type in metadata or inferring from action target.
    // For now, let's skip if we can't reliably determine role from Log object alone without extra context.
    // Alternatively, check for 'RLS_VIOLATION' or similar if logged.

    // 3. BULK_UPDATE Check
    // High volume of updates in short time
    const updates = recentLogs.filter(log =>
        ['UPDATE', 'DELETE'].includes(log.actionRaw)
    );

    if (updates.length >= RULES.BULK_UPDATE.threshold) {
        anomalies.push({
            type: 'BULK_UPDATE',
            description: `短時間での大量データ変更を検知しました (${updates.length}件)`,
            detectedAt: now.toISOString(),
            relatedLogIds: updates.map(l => l.id),
            riskLevel: 'medium'
        });
    }

    return anomalies;
}
