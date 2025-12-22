
import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { detectAnomaly } from '../../lib/audit/anomalyDetector';
import { notifier } from '../../lib/notification/notifier';
import { logService } from '../logs/log.service';
import type { Log } from '../../lib/types';
import { subMinutes } from 'date-fns';

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute
const LOOKBACK_MINUTES = 10; // Look back 10 minutes for anomalies

export const useAnomalyMonitor = () => {
    const lastCheckRef = useRef<Date>(new Date());

    useEffect(() => {
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

                if (error || !recentLogsData) return;

                const logs = recentLogsData.map(logService.mapLogFromDb);

                // Run detection
                const anomalies = detectAnomaly(logs);

                for (const anomaly of anomalies) {
                    // Check if we recently alerted this (Simple deduping logic)
                    // We can check if we have created an ANOMALY_DETECTED log for this specific type within last few minutes?
                    // For simplicity: We'll query if an ANOMALY_DETECTED log exists in the last 5 minutes with the same description

                    const { data: existingAlerts } = await supabase
                        .from('audit_logs')
                        .select('id')
                        .eq('action', 'ANOMALY_DETECTED')
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

                    // Notify Admin
                    notifier.anomaly(anomaly.description, {
                        actionLabel: 'ダッシュボードへ',
                        actionHref: '/audit-dashboard'
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
