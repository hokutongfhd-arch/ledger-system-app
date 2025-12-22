import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function fixAdminMetadata() {
    console.log('🚀 Checking Admin Metadata alignment...');

    // 1. Get all employees with 'admin' authority
    const { data: admins, error } = await supabase
        .from('employees')
        .select('*')
        .eq('authority', 'admin');

    if (error) {
        console.error('Failed to fetch admins:', error);
        return;
    }

    console.log(`Found ${admins.length} admins in DB.`);

    for (const admin of admins) {
        if (!admin.auth_id) {
            console.log(`Skipping ${admin.name} (No Auth ID linked)`);
            continue;
        }

        console.log(`Updating metadata for ${admin.name} (${admin.employee_code})...`);

        const { error: updateError } = await supabase.auth.admin.updateUserById(admin.auth_id, {
            app_metadata: {
                role: 'admin',
                employee_code: admin.employee_code
            }
        });

        if (updateError) {
            console.error(`  -> Failed: ${updateError.message}`);
        } else {
            console.log(`  -> Success: Set role='admin'`);
        }
    }
    console.log('Done.');
}

fixAdminMetadata();
