import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Lazy client creator
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Supabase URL or Service Role Key is missing');
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
        const supabaseAdmin = getSupabaseAdmin();

        // 1. Fetch all employees from DB
        const { data: employees, error: dbError } = await supabaseAdmin
            .from('employees')
            .select('*');

        if (dbError) {
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        // 2. Fetch all existing Auth Users (limit 1000 for this fix)
        // In production with >1000 users, pagination is needed.
        const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

        if (listError) {
            return NextResponse.json({ error: listError.message }, { status: 500 });
        }

        const results = [];

        // 3. Iterate and Sync
        for (const emp of employees) {
            const email = `${emp.employee_code}@ledger-system.local`;
            const password = emp.password || '123456';
            const role = emp.authority === 'admin' ? 'admin' : 'user';

            const existingUser = authUsers.find(u => u.email === email);

            let authId = existingUser?.id;
            let action = 'skipped';

            if (existingUser) {
                // Update existing user to ensure password match
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    existingUser.id,
                    {
                        password: password,
                        user_metadata: { name: emp.name },
                        app_metadata: {
                            role: role,
                            employee_code: emp.employee_code
                        },
                        email_confirm: true
                    }
                );
                if (updateError) {
                    results.push({ code: emp.employee_code, status: 'error', error: updateError.message });
                    continue;
                }
                action = 'updated';
            } else {
                // Create new user
                const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password: password,
                    email_confirm: true,
                    user_metadata: { name: emp.name },
                    app_metadata: {
                        role: role,
                        employee_code: emp.employee_code
                    }
                });

                if (createError) {
                    results.push({ code: emp.employee_code, status: 'error', error: createError.message });
                    continue;
                }
                authId = createData.user.id;
                action = 'created';
            }

            // 4. Update DB with auth_id
            if (authId && emp.auth_id !== authId) {
                await supabaseAdmin
                    .from('employees')
                    .update({ auth_id: authId })
                    .eq('id', emp.id);
            }

            results.push({ code: emp.employee_code, status: 'success', action });
        }

        return NextResponse.json({ success: true, count: results.length, results });

    } catch (err: any) {
        console.error('Sync API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
