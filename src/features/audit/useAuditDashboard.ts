
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
            const { logs: logsData, loginFailcount24h, unacknowledgedAnomalyCount, recentAnomalies: rAnomaliesRaw, error } = await fetchDashboardStatsServer(startDate.toISOString());

            if (error) {
                throw new Error(error);
            }

            // Map raw server data to Log type
            const logs: Log[] = (logsData || []).map((d: any) => ({
                id: d.id,
                timestamp: d.occurred_at,
                action: d.action_type, // Fallback to raw if logic is needed later
                actionRaw: d.action_type,
                result: d.result,
                actorName: d.actor_name,
                actorEmployeeCode: d.actor_employee_code,
                severity: d.severity,
                target: d.target_type || '',
                targetRaw: d.target_type || '',
                targetId: d.target_id || '',
                ipAddress: d.ip_address || '',
                details: '',
                user: d.actor_name || '',
                metadata: d.metadata || {},
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

            // Chart: Trend (Logs per day) - Multi-axis
            const trendMap = new Map<string, { count: number; failureCount: number; anomalyCount: number }>();
            logs.forEach((log: any) => {
                const day = log.timestamp.split('T')[0];
                const current = trendMap.get(day) || { count: 0, failureCount: 0, anomalyCount: 0 };
                current.count++;
                if (log.result === 'failure') current.failureCount++;
                if (log.actionRaw === 'ANOMALY_DETECTED') current.anomalyCount++;
                trendMap.set(day, current);
            });

            const trend: DayStat[] = Array.from(trendMap.entries())
                .map(([date, stats]) => ({ date, ...stats }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Chart: Action Distribution
            const actionMap = new Map<string, number>();
            logs.forEach((log: any) => {
                const action = log.actionRaw;
                actionMap.set(action, (actionMap.get(action) || 0) + 1);
            });

            const ACTION_COLOR_MAP: Record<string, string> = {
                LOGIN_SUCCESS: '#0088FE', // Blue
                ANOMALY_DETECTED: '#FF6B6B', // Coral
                VIEW_PAGE: '#FFBB28', // Yellow
                LOGIN_FAILURE: '#7C3AED', // Violet
                CREATE: '#FF8042', // Orange
                UPDATE: '#00C49F', // Green
                DELETE: '#8884d8', // Purple
                LOGOUT: '#82ca9d'  // Light Green
            };

            const distribution: ActionTypeStat[] = Array.from(actionMap.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by count first
                .map(([action, count], index) => {
                    let fill = ACTION_COLOR_MAP[action] || COLORS[index % COLORS.length];

                    return {
                        action,
                        count,
                        fill
                    };
                });

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

            // Top Actors
            const actorMap = new Map<string, { count: number; name: string }>();
            const anomalyActorMap = new Map<string, { count: number; name: string }>();

            logs.forEach((log: any) => {
                const code = log.actorEmployeeCode;
                const name = log.actorName;
                if (!code) return;

                const current = actorMap.get(code) || { count: 0, name };
                current.count++;
                actorMap.set(code, current);

                if (log.actionRaw === 'ANOMALY_DETECTED') {
                    const currentA = anomalyActorMap.get(code) || { count: 0, name };
                    currentA.count++;
                    anomalyActorMap.set(code, currentA);
                }
            });

            const topActors = Array.from(actorMap.entries())
                .map(([code, stats]) => ({ code, ...stats }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            const topAnomalyActors = Array.from(anomalyActorMap.entries())
                .map(([code, stats]) => ({ code, ...stats }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // Map Recent Anomalies
            const recentAnomalies: Log[] = (rAnomaliesRaw || []).map((d: any) => ({
                id: d.id,
                timestamp: d.occurred_at,
                action: d.action_type,
                actionRaw: d.action_type,
                result: d.result,
                actorName: d.actor_name,
                actorEmployeeCode: d.actor_employee_code,
                severity: d.severity,
                target: d.target_type || '',
                targetRaw: d.target_type || '',
                targetId: d.target_id || '',
                ipAddress: d.ip_address || '',
                details: '',
                user: d.actor_name || '',
                metadata: d.metadata || {},
                is_acknowledged: d.is_acknowledged,
            }));

            setData({
                kpi,
                trend,
                distribution,
                severityDistribution,
                topActors,
                topAnomalyActors,
                recentAnomalies
            });

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
