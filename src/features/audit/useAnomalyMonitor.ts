
import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { detectAnomaly } from '../../lib/audit/anomalyDetector';
import { notifier } from '../../lib/notification/notifier';
import { logService } from '../logs/log.service';
import type { Log } from '../../lib/types';
import { subMinutes } from 'date-fns';
import { sendSlackAlert } from '../../app/actions/slack';

const CHECK_INTERVAL_MS = 5 * 1000; // Check every 5 seconds for near-realtime
const LOOKBACK_MINUTES = 10; // Look back 10 minutes for anomalies

export const useAnomalyMonitor = () => {
    const lastCheckRef = useRef<Date>(new Date());

    useEffect(() => {
        console.log('[System Monitor] Anomaly detection service started.');

        const checkAnomalies = async () => {
            try {
                const now = new Date();
                const fromTime = subMinutes(now, LOOKBACK_MINUTES);

                // Fetch recent logs
                // Note: In a real standardized system, we might want to filter only logs NEWER than last check + overlap
                // But for stateless rule detection (like "5 failures in 10 mins"), we need the window.
                const { data: recentLogsData, error } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .gte('occurred_at', fromTime.toISOString())
                    .order('occurred_at', { ascending: true });

                if (error || !recentLogsData) return;

                const logs = recentLogsData.map(logService.mapLogFromDb);

                // Run detection
                const anomalies = detectAnomaly(logs);

                for (const anomaly of anomalies) {
                    // Check if we recently alerted this (Simple deduping logic)
                    // We query if an ANOMALY_DETECTED log exists in the last 5 minutes with the same description
                    const { data: existingAlerts } = await supabase
                        .from('audit_logs')
                        .select('id')
                        .eq('action_type', 'ANOMALY_DETECTED')
                        .gte('occurred_at', subMinutes(now, 5).toISOString())
                        .ilike('details', `%${anomaly.type}%`); // Loose check

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
                    sendSlackAlert(
                        `*${anomaly.type} Detected*\n${anomaly.description}`,
                        {
                            riskLevel: anomaly.riskLevel,
                            detectedAt: anomaly.detectedAt,
                            relatedLogIds: anomaly.relatedLogIds
                        }
                    ).then(async (result) => {
                        if (!result.success) {
                            console.error('Slack Notification Failed:', result.error);
                            // Optional: Log failure to audit_logs
                            await logService.createLog({
                                target_type: 'system',
                                action_type: 'SLACK_NOTIFY_FAILED',
                                details: `Failed to send slack alert: ${result.error}`,
                                actor_name: 'System Monitor',
                                result: 'failure'
                            });
                        }
                    });
                }

                lastCheckRef.current = now;

            } catch (err) {
                console.error('Anomaly Monitor Error:', err);
                // Fail-safe: do not crash app
            }
        };

        // Initial check
        checkAnomalies();

        // Interval check
        const intervalId = setInterval(checkAnomalies, CHECK_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, []);
};
