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

export async function fetchDashboardStatsServer(startDateStr: string) {
    try {
        const supabase = getSupabaseClient();
        // Fetch all logs since startDate
        const { data: logs, error } = await supabase
            .from('audit_logs')
            .select('id, occurred_at, action_type, result, actor_name, actor_employee_code, severity, target_type, target_id, ip_address')
            .gte('occurred_at', startDateStr)
            .order('occurred_at', { ascending: true });

        if (error) {
            console.error('Fetch Logs Error:', error);
            throw error;
        }

        // ------------------------------------------------------------------
        // Resolve Actor Names from Employees Table
        // ------------------------------------------------------------------
        // Extract unique employee codes from logs
        const actorCodes = Array.from(new Set(
            (logs || [])
                .map((l: any) => l.actor_employee_code)
                .filter((code: any) => code) // Filter out null/undefined/empty
        )) as string[];

        if (actorCodes.length > 0) {
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('employee_code, name')
                .in('employee_code', actorCodes);

            if (empError) {
                console.error('Failed to resolve employee names:', empError);
            } else if (employees) {
                const nameMap = new Map(employees.map(e => [e.employee_code, e.name]));

                // Update logs with latest names
                // We mutate the logs array in place or map it
                if (logs) {
                    logs.forEach((log: any) => {
                        if (log.actor_employee_code && nameMap.has(log.actor_employee_code)) {
                            log.actor_name = nameMap.get(log.actor_employee_code);
                        }
                    });
                }
            }
        }
        // ------------------------------------------------------------------

        // Fetch Login Failures count for last 24h
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { count: loginFail24h, error: kpiError } = await supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .gte('occurred_at', yesterday.toISOString())
            .eq('action_type', 'LOGIN_FAILURE')
            .eq('result', 'failure');

        if (kpiError) console.warn('KPI Fetch Error (Login failure):', kpiError);

        // Fetch Unacknowledged Anomalies Count
        const { count: unackCount, error: anomalyError } = await supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('action_type', 'ANOMALY_DETECTED')
            .eq('is_acknowledged', false);

        if (anomalyError) console.warn('Anomaly Count Error:', anomalyError);

        // Fetch Unacknowledged Anomalies (All) - No limit to match notification badge/KPI
        const { data: recentAnomaliesData, error: recentError } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('action_type', 'ANOMALY_DETECTED')
            .eq('is_acknowledged', false)
            .order('occurred_at', { ascending: false });

        if (recentError) console.warn('Recent Anomalies Error:', recentError);

        let recentAnomalies = recentAnomaliesData || [];

        // Resolve responder names for recent anomalies
        const responderIds = Array.from(new Set(recentAnomalies.filter((l: any) => l.acknowledged_by).map((l: any) => l.acknowledged_by)));
        // Also collect actor employee codes for name resolution
        const anomalyActorCodes = Array.from(new Set(recentAnomalies.filter((l: any) => l.actor_employee_code).map((l: any) => l.actor_employee_code)));

        // We need to fetch by auth_id for responders, and by code for actors.
        // Since the employees table has both, we might need two queries or a complex one.
        // Simpler to do two queries if needed, or just specific ones.

        // 1. Resolve Responders (by auth_id)
        if (responderIds.length > 0) {
            const { data: employees } = await supabase
                .from('employees')
                .select('auth_id, name')
                .in('auth_id', responderIds);

            if (employees) {
                const nameMap = new Map(employees.map(e => [e.auth_id, e.name]));
                recentAnomalies = recentAnomalies.map((l: any) => ({
                    ...l,
                    acknowledged_by_name: l.acknowledged_by ? nameMap.get(l.acknowledged_by) : undefined
                }));
            }
        }

        // 2. Resolve Actors (by code)
        if (anomalyActorCodes.length > 0) {
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('employee_code, name')
                .in('employee_code', anomalyActorCodes);

            if (!empError && employees) {
                const nameMap = new Map(employees.map(e => [e.employee_code, e.name]));
                recentAnomalies = recentAnomalies.map((l: any) => {
                    const name = l.actor_employee_code ? nameMap.get(l.actor_employee_code) : undefined;
                    return {
                        ...l,
                        actor_name: name || l.actor_name // Fallback to existing if not found, or overwrite if found
                    };
                });
            }
        }

        return {
            logs: logs || [],
            loginFailcount24h: loginFail24h || 0,
            unacknowledgedAnomalyCount: unackCount || 0,
            recentAnomalies: recentAnomalies,
            error: null
        };

    } catch (error: any) {
        console.error('Dashboard Stats Server Error:', error);
        return { logs: [], loginFailcount24h: 0, unacknowledgedAnomalyCount: 0, error: error.message };
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
