'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { getSetupUserServer } from './auth_setup';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

const checkAuth = async () => {
    const setupUser = await getSetupUserServer();
    if (setupUser) return setupUser;

    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthenticated');
    return user;
};

export interface SyncMetadata {
    table: string;
    lastUpdated: string;
    count: number;
}

export async function getSyncMetadataAction(): Promise<SyncMetadata[]> {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const tables = [
        'iphones',
        'tablets',
        'featurephones',
        'routers',
        'employees',
        'areas',
        'addresses'
    ];

    const results = await Promise.all(tables.map(async (table) => {
        // Get max updated_at and total count for each table
        const { data, error, count } = await admin
            .from(table)
            .select('updated_at', { count: 'exact', head: true })
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error(`Sync error for ${table}:`, error.message);
            return { table, lastUpdated: '', count: 0 };
        }

        return {
            table,
            lastUpdated: data?.[0]?.updated_at || '',
            count: count || 0
        };
    }));

    return results;
}
