'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client with Service Role Key to bypass RLS for administrative view
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function fetchOperationLogsServer(params: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
    actor?: string;
    operation?: string;
    tableName?: string;
    sort?: { field: 'created_at' | 'actor_name'; order: 'asc' | 'desc' };
    includeArchived?: boolean;
}) {
    try {
        let query = supabaseAdmin
            .from('logs')
            .select('*', { count: 'exact' });

        // Archive Filter
        if (params.includeArchived) {
            query = query.eq('is_archived', true);
        } else {
            query = query.eq('is_archived', false);
        }

        // Filters
        if (params.startDate) query = query.gte('created_at', params.startDate);
        if (params.endDate) query = query.lte('created_at', params.endDate);
        if (params.operation) query = query.eq('operation', params.operation);
        if (params.tableName) query = query.eq('table_name', params.tableName);

        if (params.actor) {
            if (/^[0-9]+$/.test(params.actor)) {
                query = query.like('actor_code', `%${params.actor}%`);
            } else {
                query = query.like('actor_name', `%${params.actor}%`);
            }
        }

        // Sorting
        const sortField = params.sort?.field === 'actor_name' ? 'actor_name' : 'created_at';
        const sortOrder = params.sort?.order === 'asc' ? true : false;
        query = query.order(sortField, { ascending: sortOrder });

        // Pagination
        const page = params.page || 1;
        const pageSize = params.pageSize || 15;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) {
            console.error('Fetch Operation Logs Error:', error);
            throw new Error(error.message);
        }

        return { logs: data || [], total: count || 0 };

    } catch (error: any) {
        console.error('Operation Log Server Action Error:', error);
        return { logs: [], total: 0, error: error.message };
    }
}
