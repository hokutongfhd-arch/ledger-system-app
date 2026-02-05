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
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            employee_code,
            email,
            name,
            password,
            // Other fields
            name_kana,
            gender,
            birthday,
            join_date,
            age_at_month_end,
            years_in_service,
            months_in_service,
            area_code,
            address_code,
            authority,
            department_code
        } = body;

        // Basic Validation
        if (!employee_code || !email || !name) {
            return NextResponse.json({ error: 'Missing required fields (employee_code, email, name)' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // --- Step 1: Resolve Auth User (Identity Resolution) ---
        let targetAuthId: string | null = null;
        let authAction = 'none';

        // 1-A. Check if Employee exists (Primary Check)
        const { data: existingEmployee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, auth_id, email')
            .eq('employee_code', employee_code)
            .single();

        if (empError && empError.code !== 'PGRST116') { // PGRST116 is "Row not found"
            throw new Error(`Database verify failed: ${empError.message}`);
        }

        if (existingEmployee && existingEmployee.auth_id) {
            // Priority 1: Use existing connection
            targetAuthId = existingEmployee.auth_id;
            authAction = 'update_by_id';
        } else {
            // Priority 2: New Employee (or missing auth_id linkage) -> Lookup by Email
            // CRITICAL: Only do this if NO existing employee record found.
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

            if (listError) throw new Error(`Auth lookup failed: ${listError.message}`);

            // Manual filter as listUsers search can be fuzzy depending on config, exact match is safer
            const existingAuthUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

            if (existingAuthUser) {
                // Priority 3: Reuse existing Auth User
                targetAuthId = existingAuthUser.id;
                authAction = 'reuse_existing';
            } else {
                // Priority 4: Create New Auth User
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password: password || '12345678', // Default if missing, though typically required
                    email_confirm: true,
                    user_metadata: { name, employee_code }
                });

                if (createError) throw new Error(`Auth create failed: ${createError.message}`);
                targetAuthId = newUser.user.id;
                authAction = 'created';
            }
        }

        // --- Step 2: Update Auth User Metadata/Email ---
        if (authAction !== 'created' && targetAuthId) {
            // Ensure Email and Metadata are in sync
            // Note: Changing email here requires email_confirm: true to skip re-verification if desired
            const updates: any = {
                user_metadata: { name, employee_code },
                email_confirm: true
            };

            // Only update email/password if they are explicitly provided and different (optimization)
            // But simpler to just overwrite to ensure consistency.
            if (email) updates.email = email;
            if (password) updates.password = password;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                targetAuthId,
                updates
            );

            if (updateError) throw new Error(`Auth update failed: ${updateError.message}`);
        }

        // --- Step 3: Upsert Employee Record ---
        const employeeData = {
            employee_code,
            auth_id: targetAuthId, // Enforce linkage
            name,
            name_kana,
            email, // Sync email column
            gender,
            birthday,
            join_date,
            age_at_month_end,
            years_in_service,
            months_in_service,
            area_code,
            address_code,
            authority: authority === 'admin' ? 'admin' : 'user', // Normalize
            // Handle other fields as needed
        };

        const { data: upsertResult, error: upsertError } = await supabaseAdmin
            .from('employees')
            .upsert(employeeData, { onConflict: 'employee_code' }) // Use employee_code as key
            .select()
            .single();

        if (upsertError) {
            // OPTIONAL: Compensation logic (Delete Auth if it was just created?)
            // For now, logging error. Auth user will remain "orphaned" efficiently but can be reused next time.
            throw new Error(`Employee upsert failed: ${upsertError.message}`);
        }

        return NextResponse.json({
            success: true,
            employee: upsertResult,
            authStatus: authAction,
            authId: targetAuthId
        });

    } catch (error: any) {
        console.error('Upsert API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
