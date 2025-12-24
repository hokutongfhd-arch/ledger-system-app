
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { DashboardData, KPIStats, DayStat, ActionTypeStat, SeverityStat } from '../../lib/types/audit';
import type { Log } from '../../lib/types';
import { logService } from '../logs/log.service';
import { fetchDashboardStatsServer } from '../logs/logs.server';
import { subDays, startOfDay, subHours } from 'date-fns';

type DateRange = 'today' | '7days' | '30days';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const useAuditDashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<DateRange>('7days');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate: Date;

            switch (range) {
                case 'today':
                    startDate = startOfDay(now);
                    break;
                case '7days':
                    startDate = subDays(now, 7);
                    break;
                case '30days':
                    startDate = subDays(now, 30);
                    break;
            }

            // 1. Fetch Logs via Server Action (Bypass RLS)
            // Phase 6-3: Added unacknowledgedAnomalyCount
            const { logs: logsData, loginFailcount24h, unacknowledgedAnomalyCount, error } = await fetchDashboardStatsServer(startDate.toISOString());

            if (error) {
                throw new Error(error);
            }

            // Map raw server data to Log type if needed, or use as is
            // Note: Server action returns limited fields for performance, mapping partially
            const logs = (logsData || []).map((d: any) => ({
                timestamp: d.occurred_at,
                actionRaw: d.action_type,
                result: d.result,
                actorName: d.actor_name,
                // other fields are undefined but okay for stats
            }));

            // --- Aggregation ---

            // KPI: Today's numbers
            const todayStart = startOfDay(now).toISOString();
            const todayLogs = logs.filter((l: any) => l.timestamp >= todayStart);

            const kpi: KPIStats = {
                todayActionCount: todayLogs.length,
                todayFailureCount: todayLogs.filter((l: any) => l.result === 'failure').length,
                loginFailureCount24h: loginFailcount24h || 0,
                unacknowledgedAnomalyCount: unacknowledgedAnomalyCount || 0,
                adminActionCount: todayLogs.filter((l: any) =>
                    ['CREATE', 'UPDATE', 'DELETE'].includes(l.actionRaw)
                ).length
            };

            // Chart: Trend (Logs per day)
            const trendMap = new Map<string, number>();
            logs.forEach((log: any) => {
                const day = log.timestamp.split('T')[0];
                trendMap.set(day, (trendMap.get(day) || 0) + 1);
            });

            // Fill gaps if necessary (optional, skipping for simple implementation)
            const trend: DayStat[] = Array.from(trendMap.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Chart: Action Distribution
            const actionMap = new Map<string, number>();
            logs.forEach((log: any) => {
                const action = log.actionRaw;
                actionMap.set(action, (actionMap.get(action) || 0) + 1);
            });

            const distribution: ActionTypeStat[] = Array.from(actionMap.entries())
                .map(([action, count], index) => {
                    let fill = COLORS[index % COLORS.length];
                    if (action === 'ANOMALY_DETECTED') fill = '#EF4444'; // Red-500 for Alert
                    else if (action === 'LOGIN_FAILURE') fill = '#F59E0B'; // Amber-500 for Warning

                    return {
                        action,
                        count,
                        fill
                    };
                })
                .sort((a, b) => b.count - a.count); // Descending

            // Chart: Severity Distribution (Anomaly Only)
            const severityDistribution: SeverityStat[] = [];
            const anomalyLogs = logs.filter((l: any) => l.actionRaw === 'ANOMALY_DETECTED');

            if (anomalyLogs.length > 0) {
                const severityMap = new Map<string, number>();
                anomalyLogs.forEach((log: any) => {
                    const sev = log.severity || 'medium';
                    severityMap.set(sev, (severityMap.get(sev) || 0) + 1);
                });

                const sevOrder = ['critical', 'high', 'medium', 'low'];
                const sevColors: Record<string, string> = {
                    critical: '#991B1B', // Red-800
                    high: '#EA580C', // Orange-600
                    medium: '#EAB308', // Yellow-500
                    low: '#9CA3AF' // Gray-400
                };

                sevOrder.forEach(sev => {
                    const count = severityMap.get(sev) || 0;
                    if (count > 0) {
                        severityDistribution.push({
                            severity: sev as any,
                            count,
                            fill: sevColors[sev]
                        });
                    }
                });
            }

            setData({ kpi, trend, distribution, severityDistribution });

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            // Fallback empty data to stop loading and prevent hang
            setData(prev => prev || null);
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        loading,
        range,
        setRange,
        refresh: fetchData
    };
};
