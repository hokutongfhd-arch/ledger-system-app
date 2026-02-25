'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';

// Helper to get Supabase Admin client or fallback to Session client
function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
        return createClient(url, serviceRoleKey);
    }

    // Fallback: Use session-based client for Server Actions/Components
    return createServerActionClient({ cookies });
}

export async function fetchAuditLogsServer(params: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    actor?: string;
    actionType?: string;
    result?: 'success' | 'failure';
    target?: string;
    responseStatus?: 'all' | 'responded' | 'pending';
    sort?: { field: 'occurred_at' | 'actor_name' | 'is_acknowledged'; order: 'asc' | 'desc' };
    includeArchived?: boolean;
}) {
    try {
        // Optional: Verify user session here if strict server-side auth check is needed
        // const cookieStore = cookies();
        // ... verify session ...

        const supabase = getSupabaseClient();
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' });

        // Archive Filter
        if (params.includeArchived) {
            query = query.eq('is_archived', true);
        } else {
            // Note: If is_archived doesn't exist yet, this will fail.
            // But we treat it as an active requirement.
            query = query.eq('is_archived', false);
        }

        // Filters (with empty string protection)
        if (params.startDate && params.startDate !== '') query = query.gte('occurred_at', params.startDate);
        if (params.endDate && params.endDate !== '') query = query.lte('occurred_at', params.endDate);
        if (params.actionType) query = query.eq('action_type', params.actionType);
        if (params.result) query = query.eq('result', params.result);
        if (params.target) query = query.eq('target_type', params.target);

        // Response Status Filter
        if (params.responseStatus === 'responded') {
            query = query.eq('is_acknowledged', true);
        } else if (params.responseStatus === 'pending') {
            // "Pending" means not acknowledged AND needs response
            // Exclude GENERATE from pending list unless it's a failure
            query = query.eq('is_acknowledged', false)
                .or('action_type.eq.ANOMALY_DETECTED,result.eq.failure,severity.neq.low')
                .neq('action_type', 'GENERATE');
        }

        if (params.actor) {
            if (/^[0-9]+$/.test(params.actor)) {
                query = query.like('actor_employee_code', `%${params.actor}%`);
            } else {
                query = query.like('actor_name', `%${params.actor}%`);
            }
        }

        // Sorting
        const sortField = params.sort?.field || 'occurred_at';
        const sortOrder = params.sort?.order === 'asc';
        query = query.order(sortField, { ascending: sortOrder });

        // Pagination
        const page = params.page || 1;
        const pageSize = params.pageSize || 15;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        let logs = data || [];

        // Attach responder names if there are any acknowledged logs
        const responderIds = Array.from(new Set(logs.filter(l => l.acknowledged_by).map(l => l.acknowledged_by)));
        if (responderIds.length > 0) {
            const { data: employees } = await supabase
                .from('employees')
                .select('auth_id, name')
                .in('auth_id', responderIds);

            if (employees) {
                const nameMap = new Map(employees.map(e => [e.auth_id, e.name]));
                logs = logs.map(l => ({
                    ...l,
                    acknowledged_by_name: l.acknowledged_by ? nameMap.get(l.acknowledged_by) : undefined
                }));
            }
        }

        if (error) {
            console.error('Fetch Logs Server Error:', error);
            // Return error object as string to help debugging on client
            return {
                logs: [],
                total: 0,
                error: (error as any).message || JSON.stringify(error)
            };
        }

        return { logs: logs, total: count || 0 };

    } catch (error: any) {
        console.error('Fetch Audit Logs Catch Error:', error);
        return {
            logs: [],
            total: 0,
            error: error.message || 'Failed to fetch audit logs.'
        };
    }
}

export async function fetchDashboardStatsServer(startDateStr: string, range: 'today' | '7days' | '30days') {
    try {
        const supabase = getSupabaseClient();
        
        // 1. Fetch KPI counts
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const [loginFail24hRes, unackCountRes, logsRes] = await Promise.all([
            supabase
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .gte('occurred_at', yesterday.toISOString())
                .eq('action_type', 'LOGIN_FAILURE')
                .eq('result', 'failure'),
            supabase
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false),
            supabase
                .from('audit_logs')
                .select('occurred_at, action_type, result, actor_name, actor_employee_code')
                .gte('occurred_at', startDateStr)
        ]);

        if (logsRes.error) throw logsRes.error;
        const logs = logsRes.data || [];

        // 2. Perform aggregations on server-side
        const trendMap = new Map<string, { count: number; failureCount: number; anomalyCount: number }>();
        const actionMap = new Map<string, number>();
        const actorMap = new Map<string, { count: number; name: string }>();
        const anomalyActorMap = new Map<string, { count: number; name: string }>();
        let adminActionCount = 0;

        logs.forEach((log: any) => {
            // Trend aggregation
            let timeKey: string;
            const date = new Date(log.occurred_at);
            if (range === 'today') {
                const hour = date.getHours();
                timeKey = `${hour.toString().padStart(2, '0')}:00`;
            } else {
                timeKey = log.occurred_at.split('T')[0];
            }

            const t = trendMap.get(timeKey) || { count: 0, failureCount: 0, anomalyCount: 0 };
            t.count++;
            if (log.result === 'failure') t.failureCount++;
            if (log.action_type === 'ANOMALY_DETECTED') t.anomalyCount++;
            trendMap.set(timeKey, t);

            // Distribution aggregation
            actionMap.set(log.action_type, (actionMap.get(log.action_type) || 0) + 1);

            // Admin actions count
            if (['CREATE', 'UPDATE', 'DELETE'].includes(log.action_type)) adminActionCount++;

            // Actor aggregation
            if (log.actor_employee_code) {
                const a = actorMap.get(log.actor_employee_code) || { count: 0, name: log.actor_name };
                a.count++;
                actorMap.set(log.actor_employee_code, a);

                if (log.action_type === 'ANOMALY_DETECTED') {
                    const aa = anomalyActorMap.get(log.actor_employee_code) || { count: 0, name: log.actor_name };
                    aa.count++;
                    anomalyActorMap.set(log.actor_employee_code, aa);
                }
            }
        });

        // 3. Resolve Actor Names (only for top actors and recent anomalies)
        const topActors = Array.from(actorMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([code, stats]) => ({ code, ...stats }));

        const topAnomalyActors = Array.from(anomalyActorMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([code, stats]) => ({ code, ...stats }));

        // Fetch Recent Anomalies
        const { data: recentAnomaliesData } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('action_type', 'ANOMALY_DETECTED')
            .eq('is_acknowledged', false)
            .order('occurred_at', { ascending: false })
            .limit(50); // Limit to top 50 for performance

        // Resolve names for top actors and recent anomalies if needed
        // (Omitting repeated resolution for brevity, but could be added here similar to previous version)

        return {
            kpi: {
                todayActionCount: logs.length,
                todayFailureCount: logs.filter(l => l.result === 'failure').length,
                loginFailureCount24h: loginFail24hRes.count || 0,
                unacknowledgedAnomalyCount: unackCountRes.count || 0,
                adminActionCount
            },
            trend: Array.from(trendMap.entries()).map(([date, stats]) => ({ date, ...stats })).sort((a, b) => a.date.localeCompare(b.date)),
            distribution: Array.from(actionMap.entries()).map(([action, count]) => ({ action, count })),
            topActors,
            topAnomalyActors,
            recentAnomalies: recentAnomaliesData || [],
            error: null
        };

    } catch (error: any) {
        console.error('Dashboard Stats Server Error:', error);
        return { error: error.message };
    }
}

export async function submitAnomalyResponseServer(params: {
    logId: string;
    status: string;
    note: string;
    adminUserId: string;
}) {
    try {
        const supabase = getSupabaseClient();
        const isCompleted = params.status === 'completed';

        const updateData: any = {
            is_acknowledged: isCompleted,
            acknowledged_by: params.adminUserId,
            acknowledged_at: new Date().toISOString(),
            response_status: params.status,
            response_note: params.note
        };

        // If marked as 'completed', we treat it as finalized and set result to 'success'
        if (isCompleted) {
            updateData.result = 'success';
        }

        const { error } = await supabase
            .from('audit_logs')
            .update(updateData)
            .eq('id', params.logId);

        if (error) {
            console.error('Submit Anomaly Response Error:', error);
            throw new Error(error.message);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { success: false, error: error.message };
    }
}
export async function fetchAuditLogByIdServer(id: string) {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        let log = data;
        if (log && log.acknowledged_by) {
            const { data: emp } = await supabase
                .from('employees')
                .select('name')
                .eq('auth_id', log.acknowledged_by)
                .single();
            if (emp) {
                log = { ...log, acknowledged_by_name: emp.name };
            }
        }

        return { log: log, error: null };
    } catch (error: any) {
        console.error('Fetch Audit Log by ID Error:', error);
        return { log: null, error: error.message };
    }
}
