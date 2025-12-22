import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
// Read from .env.local or process.env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    console.error('Usage: node --env-file=.env.local scripts/migration/migrate_users.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const DOMAIN = 'ledger-system.local';

async function migrate() {
    console.log('🚀 Starting migration...');

    // 1. Fetch all employees
    const { data: employees, error: fetchError } = await supabase
        .from('employees')
        .select('*');

    if (fetchError) {
        console.error('Failed to fetch employees:', fetchError);
        process.exit(1);
    }

    console.log(`Found ${employees.length} employees to process.`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const emp of employees) {
        const email = `${emp.employee_code}@${DOMAIN}`;
        const password = emp.password; // Assuming plaintext as per requirement
        const role = emp.authority === 'admin' ? 'admin' : 'user';

        console.log(`Processing ${emp.employee_code} (${role})...`);

        try {
            // Check if user already exists
            const { data: listData } = await supabase.auth.admin.listUsers();
            // Note: listUsers is paginated, for robust prod use, implement pagination. 
            // For now assuming < 50 users or just trying create directly.

            // Actually, best practice is to try to get user by email directly if possible, or just try create and catch error.
            // But listUsers is good for cleanup. Let's try createUser directly.

            const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: {
                    name: emp.name
                },
                app_metadata: {
                    role: role,
                    employee_code: emp.employee_code
                }
            });

            let userId = authUser?.user?.id;

            if (createError) {
                // If error is "User already registered", we need to find that user's ID
                if (createError.message.includes('already registered') || createError.status === 422) {
                    console.log(`  -> User already exists. Fetching ID...`);
                    // This is inefficient for many users but safe for migration script
                    const { data: users } = await supabase.auth.admin.listUsers();
                    const existing = users.users.find(u => u.email === email);
                    if (existing) {
                        userId = existing.id;
                        // Optional: Update metadata if needed
                        await supabase.auth.admin.updateUserById(userId, {
                            app_metadata: {
                                role: role,
                                employee_code: emp.employee_code
                            }
                        });
                        skipCount++;
                    } else {
                        console.error(`  -> Failed to find existing user ID for ${email}`);
                        errorCount++;
                        continue;
                    }
                } else {
                    console.error(`  -> Create failed: ${createError.message}`);
                    errorCount++;
                    continue;
                }
            } else {
                successCount++;
                console.log(`  -> Created new Auth User: ${userId}`);
            }

            // Link back to employees table
            if (userId) {
                const { error: updateError } = await supabase
                    .from('employees')
                    .update({ auth_id: userId })
                    .eq('id', emp.id);

                if (updateError) {
                    console.error(`  -> Failed to link auth_id: ${updateError.message}`);
                    errorCount++;
                } else {
                    console.log(`  -> Linked auth_id to public.employees`);
                }
            }

        } catch (err) {
            console.error(`  -> Unexpected error:`, err);
            errorCount++;
        }
    }

    console.log('-----------------------------------');
    console.log(`Migration Complete.`);
    console.log(`Success (Created): ${successCount}`);
    console.log(`Skipped (Exists): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
}

migrate();
