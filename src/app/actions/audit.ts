'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function fetchAuditLogsAction(startDate: string, endDate: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .gte('occurred_at', startDate)
        .lte('occurred_at', endDate)
        .order('occurred_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export async function fetchLogMinDateAction() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .select('occurred_at')
        .order('occurred_at', { ascending: true })
        .limit(1)
        .single();

    if (error) {
        // Not an error in UX, just no logs
        return null;
    }
    return data?.occurred_at || null;
}
