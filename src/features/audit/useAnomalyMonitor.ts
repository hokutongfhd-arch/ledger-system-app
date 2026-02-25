import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { detectAnomaly } from '../../lib/audit/anomalyDetector';
import { notifier } from '../../lib/notification/notifier';
import { logService } from '../logs/log.service';
import { auditService, AnomalyRule } from './audit.service';
import { subMinutes } from 'date-fns';
import { sendSlackAlert } from '../../app/actions/slack';

const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds (reduced frequency slightly)
const DEFAULT_LOOKBACK_MINUTES = 10;

export const useAnomalyMonitor = () => {
    const lastCheckRef = useRef<Date>(new Date());
    const rulesRef = useRef<AnomalyRule[]>([]);

    useEffect(() => {
        console.log('[System Monitor] Anomaly detection service started.');

        const checkAnomalies = async () => {
            try {
                // 1. Fetch Rules (Refresh every time for now to be reactive, or we could fetch periodically)
                const rules = await auditService.fetchAnomalyRules();
                rulesRef.current = rules;

                // 2. Determine Lookback Window
                // Find maximum window_minutes among enabled rules
                const maxWindow = rules.reduce((max, rule) => {
                    if (!rule.enabled) return max;
                    const window = rule.params.window_minutes || DEFAULT_LOOKBACK_MINUTES;
                    return Math.max(max, window);
                }, DEFAULT_LOOKBACK_MINUTES);

                const now = new Date();
                const fromTime = subMinutes(now, maxWindow);

                // 3. Fetch recent logs
                const { data: recentLogsData, error } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .gte('occurred_at', fromTime.toISOString())
                    .order('occurred_at', { ascending: true });

                if (error || !recentLogsData) return;

                const logs = recentLogsData.map(logService.mapLogFromDb);

                // 4. Run detection with dynamic rules
                const anomalies = detectAnomaly(logs, rules);

                for (const anomaly of anomalies) {
                    // Check if we recently alerted this (Simple deduping logic)
                    // We query if an ANOMALY_DETECTED log exists in the last 5 minutes with the same type
                    const { data: existingAlerts } = await supabase
                        .from('audit_logs')
                        .select('id')
                        .eq('action_type', 'ANOMALY_DETECTED')
                        .gte('occurred_at', subMinutes(now, 5).toISOString())
                        .ilike('details', `%${anomaly.type}%`);

                    if (existingAlerts && existingAlerts.length > 0) {
                        continue; // Already alerted recently
                    }

                    // Log the anomaly
                    await logService.createLog({
                        target_type: 'system',
                        action_type: 'ANOMALY_DETECTED',
                        details: `${anomaly.type}: ${anomaly.description}`,
                        actor_name: 'System Monitor',
                        result: 'success',
                        metadata: {
                            riskLevel: anomaly.riskLevel,
                            relatedLogIds: anomaly.relatedLogIds,
                            detectedAt: anomaly.detectedAt
                        }
                    });

                    // Notify Admin (Toast)
                    notifier.anomaly(anomaly.description, {
                        actionLabel: 'ダッシュボードへ',
                        actionHref: '/audit-dashboard'
                    });

                    // Notify External (Slack)
                    const slackResult = await sendSlackAlert(
                        `${anomaly.type} Detected`,
                        anomaly.description,
                        {
                            anomalyType: anomaly.type,
                            occurredAt: anomaly.detectedAt,
                            riskLevel: anomaly.riskLevel,
                            relatedLogIds: anomaly.relatedLogIds,
                        }
                    );

                    if (!slackResult.success) {
                        console.error('Slack Notification Failed:', slackResult.error);
                    }
                }

                lastCheckRef.current = now;

            } catch (err) {
                console.error('Anomaly Monitor Error:', err);
            }
        };

        // Initial check
        checkAnomalies();

        // Interval check
        const intervalId = setInterval(checkAnomalies, CHECK_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, []);
};
