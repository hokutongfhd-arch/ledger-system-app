'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface SyncMetadata {
    table: string;
    count: number;
    lastUpdated: string | null;
}

const getSupabase = async () => {
    try {
        const cookieStore = await cookies();
        return createServerActionClient({ cookies: () => cookieStore as any });
    } catch (e) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        return createClient(url, key);
    }
};

export async function getSyncMetadataAction(): Promise<SyncMetadata[]> {
    const supabase = await getSupabase();
    const tables = [
        'iphones', 'tablets', 'featurephones', 'routers', 
        'employees', 'areas', 'addresses'
    ];

    try {
        const results = await Promise.all(tables.map(async (table) => {
            // Get count and latest updated_at
            const { count, error: countError } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            const { data: latest, error: latestError } = await supabase
                .from(table)
                .select('updated_at')
                .order('updated_at', { ascending: false })
                .limit(1);

            return {
                table,
                count: count || 0,
                lastUpdated: latest && latest[0] ? latest[0].updated_at : null
            };
        }));

        return results;
    } catch (error) {
        console.error('Failed to get sync metadata:', error);
        return [];
    }
}
