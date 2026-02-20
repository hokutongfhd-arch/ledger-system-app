import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { upsertEmployeeLogic } from '../shared';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

        const cookieStore = await cookies();
        // @ts-expect-error: cookieStore type mismatch
        const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
        // Retrieve session user to use as "Actor" for audit logs
        const { data: { session } } = await supabaseUser.auth.getSession();
        let actorUser = session?.user;

        // Fallback for Initial Setup Account
        if (!actorUser) {
            const isSetup = cookieStore.get('is_initial_setup')?.value === 'true';
            if (isSetup) {
                actorUser = {
                    id: 'INITIAL_SETUP_ACCOUNT',
                    email: 'setup_admin@system.local',
                    user_metadata: {
                        name: '初期セットアップアカウント',
                        employee_code: '999999'
                    },
                    app_metadata: { role: 'admin' },
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                } as any;
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabaseAdmin = getSupabaseAdmin();
        const results = [];

        // Process sequentially to be safe (or Promise.all with concurrency limit if needed)
        // Sequential is safer for auth rate limits.
        for (const emp of employees) {
            // We pass 'actorUser' so that shared logic can patch the audit log after upsert
            const res = await upsertEmployeeLogic(supabaseAdmin, emp, actorUser);
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
