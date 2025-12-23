'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase Client with Service Role Key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
}) {
    try {
        // Optional: Verify user session here if strict server-side auth check is needed
        // const cookieStore = cookies();
        // ... verify session ...

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*', { count: 'exact' });

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
