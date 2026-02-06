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

            // [FIX] Check for Email Collision (Primary Path)
            // If we are updating email, check if another user holds it.
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            const collisionUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

            if (collisionUser && collisionUser.id !== authId) {
                console.warn(`[Primary] Email collision detected for ${email}. Deleting conflicting user ${collisionUser.id}...`);
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(collisionUser.id);
                if (deleteError) {
                    console.error('[Primary] Failed to delete conflicting user:', deleteError);
                    throw new Error(`Failed to resolve email collision: ${(deleteError as any).message}`);
                }
            }

            // Verify user exists first
            const { data: { user: targetUser }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(authId);
            if (fetchError || !targetUser) {
                console.error(`[Primary] User ${authId} not found or fetch error:`, fetchError);
                // Can't update if not found/fetch error.
                // We could let it fall through to create? But authId implies we expect existence.
                return NextResponse.json({ error: `User ${authId} not found` }, { status: 404 });
            }
            console.log(`[Primary] Target user found: ${targetUser.email}`);

            // [FIX] Check for Employee Table Collision (Orphan cleanup)
            // If the employees table has a unique key on email, we must clear any orphan record holding this email.
            const { data: orphanEmployee, error: orphanError } = await supabaseAdmin
                .from('employees')
                .select('id, email')
                .eq('email', email)
                .single();

            if (orphanEmployee && orphanEmployee.id) {
                // If it's a different employee (should check auth_id link but might be broken), clear it.
                // We assume if we are updating User A to Email X, and Employee B has Email X, Employee B is an orphan/conflict.
                console.warn(`[Primary] Employee collision detected for ${email} (Employee ID: ${orphanEmployee.id}). Clearing email...`);
                await supabaseAdmin
                    .from('employees')
                    .update({ email: null }) // Or clear it to allow the new update to take it
                    .eq('id', orphanEmployee.id);
            }

            // Prepare update attributes - ONLY update password if provided
            const updateAttrs: any = {
                email: email,
                user_metadata: { name },
                app_metadata: {
                    role: userRole,
                    employee_code: code
                },
                email_confirm: true
            };

            if (password) {
                console.log('[Primary] Password update requested');
                updateAttrs.password = password;
            }

            const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                authId,
                updateAttrs
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

        // [FIX] 1.5. Try to find existing user by Employee Code (Metadata) BEFORE creating new one
        // This handles the case where email is being changed (so email lookup fails) but user exists.
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existingUserByCode = users.find((u: any) =>
            u.user_metadata?.employee_code === code ||
            u.app_metadata?.employee_code === code ||
            u.user_metadata?.employee_code === String(code)
        );

        if (existingUserByCode) {
            console.log(`Found existing user by Code ${code} (${existingUserByCode.email}). Updating...`);

            // [FIX] Check for Email Collision
            // If another user already has the new email (e.g., a duplicate created previously), delete it to allow update.
            const collisionUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            if (collisionUser && collisionUser.id !== existingUserByCode.id) {
                console.warn(`Email collision detected for ${email}. Deleting conflicting user ${collisionUser.id}...`);
                await supabaseAdmin.auth.admin.deleteUser(collisionUser.id);
            }

            const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUserByCode.id,
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

            if (updateError) {
                console.error(`Failed to update existing user ${existingUserByCode.id}:`, updateError);
                return NextResponse.json({ error: updateError.message, fullError: updateError }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                userId: existingUserByCode.id,
                message: 'User updated successfully (matched by code)'
            });
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
