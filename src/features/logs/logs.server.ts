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
    sort?: { field: 'occurred_at' | 'actor_name'; order: 'asc' | 'desc' };
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

        // Archive Filter: Exclusive mode
        if (params.includeArchived) {
            query = query.eq('is_archived', true);
        } else {
            query = query.eq('is_archived', false); // Default: Active only
        }

        // Filters
        if (params.startDate) query = query.gte('occurred_at', params.startDate);
        if (params.endDate) query = query.lte('occurred_at', params.endDate);
        if (params.actionType) query = query.eq('action_type', params.actionType);
        if (params.result) query = query.eq('result', params.result);
        if (params.target) query = query.eq('target_type', params.target);

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

        if (error) {
            console.error('Fetch Logs Server Error:', error);
            throw new Error(error.message);
        }

        return { logs: data || [], total: count || 0 };

    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { logs: [], total: 0, error: error.message };
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

        // Fetch Unacknowledged Anomalies (Recent 5)
        const { data: recentAnomaliesData, error: recentError } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('action_type', 'ANOMALY_DETECTED')
            .eq('is_acknowledged', false)
            .order('occurred_at', { ascending: false })
            .limit(5);

        if (recentError) console.warn('Recent Anomalies Error:', recentError);

        return {
            logs: logs || [],
            loginFailcount24h: loginFail24h || 0,
            unacknowledgedAnomalyCount: unackCount || 0,
            recentAnomalies: recentAnomaliesData || [],
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
        return { log: data, error: null };
    } catch (error: any) {
        console.error('Fetch Audit Log by ID Error:', error);
        return { log: null, error: error.message };
    }
}
