import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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

        // Basic Validation
        if (!body.employee_code || !body.email || !body.name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-expect-error: cookieStore type mismatch
        const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
        const { data: { session } } = await supabaseUser.auth.getSession();
        let actorUser = session?.user;

        // Fallback for Initial Setup Account if needed (though upsert is mainly UI based, setup usually uses single upsert too?)
        // If employee.service.ts calls this, it sends cookies.
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
             }
        }

        const supabaseAdmin = getSupabaseAdmin();
        const result = await upsertEmployeeLogic(supabaseAdmin, body, actorUser);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Upsert API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

