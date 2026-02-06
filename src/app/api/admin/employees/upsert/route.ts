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

        // Basic Validation
        if (!body.employee_code || !body.email || !body.name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const result = await upsertEmployeeLogic(supabaseAdmin, body);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Upsert API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

