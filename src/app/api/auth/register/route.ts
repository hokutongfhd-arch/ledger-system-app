import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { code, password, name, role } = body;

        if (!code) {
            return NextResponse.json({ error: 'Employee code is required' }, { status: 400 });
        }

        const email = `${code}@ledger-system.local`;
        const userRole = role === '管理者' || role === 'admin' ? 'admin' : 'user';
        // Password default if not provided? Form should provide it.
        // If password is empty (e.g. edit mode or not set), we can't create user without it?
        // Supabase createUser requires password or email_confirm.
        // We'll assume password is provided or use a default.
        const userPassword = password || '123456';

        // 1. Check if user exists (Optional, createUser handles duplications by error usually, but list is safer for idempotency if needed)
        // We'll try create directly to be fast.

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
            // If user already exists, we should try to fetch their ID to ensure linkage
            if (error.message.includes('already registered') || error.status === 422) {
                // Fetch existing user to return ID
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = listData.users.find(u => u.email === email);
                if (existingUser) {
                    return NextResponse.json({
                        success: true,
                        userId: existingUser.id,
                        message: 'User already exists, returning ID'
                    });
                }
            }
            console.error('Auth Create Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId: data.user.id });

    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
