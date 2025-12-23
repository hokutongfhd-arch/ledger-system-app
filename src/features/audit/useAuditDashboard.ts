
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { DashboardData, KPIStats, DayStat, ActionTypeStat } from '../../lib/types/audit';
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
            const { logs: logsData, loginFailcount24h, error } = await fetchDashboardStatsServer(startDate.toISOString());

            if (error) throw new Error(error);

            // Map raw server data to Log type if needed, or use as is
            // Note: Server action returns limited fields for performance, mapping partially
            const logs = (logsData || []).map((d: any) => ({
                timestamp: d.occurred_at,
                actionRaw: d.action_type,
                result: d.result,
                actorName: d.actor_name,
                // other fields are undefined but okay for stats
            }));

            // Login Failures from server
            // const { count: loginFailcount24h, error: kpiError } = await supabase... (Moved to server)


            // --- Aggregation ---

            // KPI: Today's numbers
            const todayStart = startOfDay(now).toISOString();
            const todayLogs = logs.filter(l => l.timestamp >= todayStart);

            const kpi: KPIStats = {
                todayActionCount: todayLogs.length,
                todayFailureCount: todayLogs.filter(l => l.result === 'failure').length,
                loginFailureCount24h: loginFailcount24h || 0,
                adminActionCount: todayLogs.filter(l =>
                    ['CREATE', 'UPDATE', 'DELETE'].includes(l.actionRaw)
                    // Note: Ideally filter by actor role if available, but for now assuming these actions imply admin/management work
                ).length
            };

            // Chart: Trend (Logs per day)
            const trendMap = new Map<string, number>();
            logs.forEach(log => {
                const day = log.timestamp.split('T')[0];
                trendMap.set(day, (trendMap.get(day) || 0) + 1);
            });

            // Fill gaps if necessary (optional, skipping for simple implementation)
            const trend: DayStat[] = Array.from(trendMap.entries())
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Chart: Action Distribution
            const actionMap = new Map<string, number>();
            logs.forEach(log => {
                const action = log.actionRaw;
                actionMap.set(action, (actionMap.get(action) || 0) + 1);
            });

            const distribution: ActionTypeStat[] = Array.from(actionMap.entries())
                .map(([action, count], index) => ({
                    action,
                    count,
                    fill: COLORS[index % COLORS.length]
                }))
                .sort((a, b) => b.count - a.count); // Descending

            setData({ kpi, trend, distribution });

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
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
