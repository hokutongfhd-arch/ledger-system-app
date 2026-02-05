import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { upsertEmployeeLogic } from '../shared';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error('Supabase Config Missing');

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employees } = body; // Array of employee objects

        if (!Array.isArray(employees)) {
            return NextResponse.json({ error: 'Invalid input: employees must be an array' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const results = [];

        // Process sequentially to be safe (or Promise.all with concurrency limit if needed)
        // Sequential is safer for auth rate limits.
        for (const emp of employees) {
            const res = await upsertEmployeeLogic(supabaseAdmin, emp);
            results.push(res);
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return NextResponse.json({
            success: true,
            processed: results.length,
            successCount,
            failureCount,
            results
        });

    } catch (error: any) {
        console.error('Bulk Upsert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
