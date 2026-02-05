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
        const { code, password, name, role, email: requestEmail, authId } = body;

        if (!code) {
            return NextResponse.json({ error: 'Employee code is required' }, { status: 400 });
        }

        // Use provided email or fallback to legacy format
        const email = requestEmail || `${code}@ledger-system.local`;
        const userRole = role === '管理者' || role === 'admin' ? 'admin' : 'user';
        const userPassword = password || '123456';

        // 1. Try to update by authId if provided (Reliable update for existing users)
        if (authId) {
            console.log(`Updating existing user by authId: ${authId}`);
            const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                authId,
                {
                    email: email, // Update email
                    password: userPassword,
                    user_metadata: { name },
                    app_metadata: {
                        role: userRole,
                        employee_code: code
                    },
                    email_confirm: true
                }
            );

            if (!updateError) {
                return NextResponse.json({
                    success: true,
                    userId: authId,
                    message: 'User updated successfully by ID'
                });
            }

            console.warn(`Failed to update by authId ${authId}:`, updateError.message);
            // If failed (e.g. user not found), fall back to create/email-match logic
        }

        // 2. Try to create new user (or update if email matches)
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
                    console.log(`User ${email} exists (found by email). Updating...`);
                    // Update existing user
                    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                        existingUser.id,
                        {
                            email: email, // Update email as well
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
