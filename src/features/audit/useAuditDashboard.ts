
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

            // 1. Fetch Aggregated Stats via Server Action
            const result = await fetchDashboardStatsServer(startDate.toISOString(), range);

            if (result.error) {
                throw new Error(result.error);
            }

            const { kpi, trend, distribution, topActors, topAnomalyActors, recentAnomalies: rAnomaliesRaw } = result;

            // Map Recent Anomalies using central service (Severity distribution is also derived from anomalies)
            const recentAnomalies: Log[] = (rAnomaliesRaw || []).map(logService.mapLogFromDb);

            // Chart: Severity Distribution (Anomaly Only)
            const severityDistribution: SeverityStat[] = [];
            const anomalyLogs = recentAnomalies; // We now only have anomalies in recentAnomalies

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

            // Color mapping for distribution
            const ACTION_COLOR_MAP: Record<string, string> = {
                LOGIN_SUCCESS: '#0088FE',
                LOGIN_FAILURE: '#7C3AED',
                LOGOUT: '#82ca9d',
                CREATE: '#FF8042',
                UPDATE: '#00C49F',
                DELETE: '#8884d8',
                EXPORT: '#FFBB28',
                GENERATE: '#FFBB28',
                IMPORT: '#FFBB28',
                DOWNLOAD_TEMPLATE: '#FFBB28',
                ANOMALY_DETECTED: '#FF6B6B',
                ANOMALY_RESPONSE: '#E76F51',
                VIEW_PAGE: '#E5E7EB',
                TEST_TRIGGER: '#9CA3AF'
            };

            const distributionWithColors: ActionTypeStat[] = (distribution || []).map((item: any, index: number) => ({
                ...item,
                fill: ACTION_COLOR_MAP[item.action] || COLORS[index % COLORS.length]
            }));

            setData({
                kpi: kpi!,
                trend: trend!,
                distribution: distributionWithColors,
                severityDistribution,
                topActors: topActors!,
                topAnomalyActors: topAnomalyActors!,
                recentAnomalies
            });

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            // Fallback empty data
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
