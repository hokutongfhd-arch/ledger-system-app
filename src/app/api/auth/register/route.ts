import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Lazy client creator to prevent build-time error if env vars are missing
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Supabase URL or Service Role Key is missing in environment variables');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export async function POST(req: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin(); // Initialize here

        const body = await req.json();
        const { code, password, name, role } = body;

        if (!code) {
            return NextResponse.json({ error: 'Employee code is required' }, { status: 400 });
        }

        const email = `${code}@ledger-system.local`;
        const userRole = role === '管理者' || role === 'admin' ? 'admin' : 'user';
        const userPassword = password || '123456';

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: userPassword,
            email_confirm: true,
            user_metadata: { name },
            app_metadata: {
                role: userRole,
                employee_code: code
            }
        });

        if (error) {
            if (error.message.includes('already registered') || error.status === 422) {
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const existingUser = listData.users.find((u: any) => u.email === email);

                if (existingUser) {
                    console.log(`User ${email} exists. Updating...`);
                    // Update existing user
                    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        existingUser.id,
                        {
                            password: userPassword,
                            user_metadata: { name },
                            app_metadata: {
                                role: userRole,
                                employee_code: code
                            },
                            email_confirm: true
                        }
                    );

                    if (updateError) {
                        console.error('Failed to update existing user:', updateError);
                        return NextResponse.json({ error: updateError.message }, { status: 500 });
                    }

                    return NextResponse.json({
                        success: true,
                        userId: existingUser.id,
                        message: 'User updated successfully'
                    });
                }
            }
            console.error('Auth Create Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId: data.user.id });

    } catch (err: any) {
        console.error('API Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        return NextResponse.json({ error: errorMessage, details: String(err) }, { status: 500 });
    }
}
