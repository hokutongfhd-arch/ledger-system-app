
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
    const [range, setRange] = useState<DateRange>('today');

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

            // Map raw server data to Log type using central service
            const logs: Log[] = (logsData || []).map(logService.mapLogFromDb);

            // --- Aggregation ---

            // KPI: Range-based numbers
            const kpi: KPIStats = {
                todayActionCount: logs.length,
                todayFailureCount: logs.filter((l: any) => l.result === 'failure').length,
                loginFailureCount24h: logs.filter((l: any) => l.actionRaw === 'LOGIN_FAILURE' && l.result === 'failure').length,
                unacknowledgedAnomalyCount: unacknowledgedAnomalyCount || 0,
                adminActionCount: logs.filter((l: any) =>
                    ['CREATE', 'UPDATE', 'DELETE'].includes(l.actionRaw)
                ).length
            };

            // Chart: Trend (Logs per day/hour) - Multi-axis
            const trendMap = new Map<string, { count: number; failureCount: number; anomalyCount: number }>();

            if (range === 'today') {
                // Hourly aggregation for business hours (08:00 - 20:00)
                for (let h = 8; h <= 20; h++) {
                    const hourStr = `${h.toString().padStart(2, '0')}:00`;
                    trendMap.set(hourStr, { count: 0, failureCount: 0, anomalyCount: 0 });
                }

                logs.forEach((log: any) => {
                    const date = new Date(log.timestamp);
                    const hour = date.getHours();
                    if (hour >= 8 && hour <= 20) {
                        const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                        const current = trendMap.get(hourStr) || { count: 0, failureCount: 0, anomalyCount: 0 };
                        current.count++;
                        if (log.result === 'failure') current.failureCount++;
                        if (log.actionRaw === 'ANOMALY_DETECTED') current.anomalyCount++;
                        trendMap.set(hourStr, current);
                    }
                });
            } else {
                // Daily aggregation
                logs.forEach((log: any) => {
                    const day = log.timestamp.split('T')[0];
                    const current = trendMap.get(day) || { count: 0, failureCount: 0, anomalyCount: 0 };
                    current.count++;
                    if (log.result === 'failure') current.failureCount++;
                    if (log.actionRaw === 'ANOMALY_DETECTED') current.anomalyCount++;
                    trendMap.set(day, current);
                });
            }

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
                LOGIN_FAILURE: '#7C3AED', // Violet
                LOGOUT: '#82ca9d',        // Light Green
                CREATE: '#FF8042',        // Orange
                UPDATE: '#00C49F',        // Green
                DELETE: '#8884d8',        // Purple

                EXPORT: '#FFBB28',        // Yellow
                GENERATE: '#FFBB28',      // Yellow (Same category as Export)
                IMPORT: '#FFBB28',
                DOWNLOAD_TEMPLATE: '#FFBB28',

                ANOMALY_DETECTED: '#FF6B6B', // Coral
                ANOMALY_RESPONSE: '#E76F51', // Burnt Orange

                VIEW_PAGE: '#E5E7EB',     // Gray (Noise)
                TEST_TRIGGER: '#9CA3AF'   // Gray
            };

            const ACTION_ORDER = [
                'LOGIN_SUCCESS',
                'LOGIN_FAILURE',
                'LOGOUT',
                'CREATE',
                'UPDATE',
                'DELETE',
                'EXPORT',
                'GENERATE',
                'IMPORT',
                'DOWNLOAD_TEMPLATE',
                'ANOMALY_DETECTED',
                'ANOMALY_RESPONSE'
            ];

            const distribution: ActionTypeStat[] = Array.from(actionMap.entries())
                .sort((a, b) => {
                    const idxA = ACTION_ORDER.indexOf(a[0]);
                    const idxB = ACTION_ORDER.indexOf(b[0]);

                    // If both are in the known list, sort by index
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;

                    // If one is known, it comes first
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;

                    // If neither, sort by count descending
                    return b[1] - a[1];
                })
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

            // Map Recent Anomalies using central service
            const recentAnomalies: Log[] = (rAnomaliesRaw || []).map(logService.mapLogFromDb);

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
            // Fallback empty data to stop loading and prevent 'No Data' crash
            setData({
                kpi: { todayActionCount: 0, todayFailureCount: 0, loginFailureCount24h: 0, unacknowledgedAnomalyCount: 0, adminActionCount: 0 },
                trend: [],
                distribution: [],
                severityDistribution: [],
                topActors: [],
                topAnomalyActors: [],
                recentAnomalies: []
            });
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Add Realtime Listener for Auto-Refresh on new anomalies
    useEffect(() => {
        const channel = supabase
            .channel('audit-dashboard-refresh')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs',
                    filter: "action_type=eq.ANOMALY_DETECTED"
                },
                () => {
                    // Refetch data when a new anomaly is detected
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    return {
        data,
        loading,
        range,
        setRange,
        refresh: fetchData
    };
};
