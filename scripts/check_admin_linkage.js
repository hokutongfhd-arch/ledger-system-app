
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Req envs missing');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function checkLinkage() {
    console.log('Checking Admin Linkage...');

    // 1. Get Admins from DB
    const { data: dbAdmins, error } = await supabase
        .from('employees')
        .select('*')
        .eq('authority', 'admin');

    if (error) { console.error(error); return; }

    // 2. Get Auth Users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) { console.error(authError); return; }

    for (const admin of dbAdmins) {
        console.log(`Checking DB Admin: ${admin.name} (${admin.employee_code})`);

        // Find matching Auth User
        const expectedEmail = `${admin.employee_code}@ledger-system.local`;
        const authUser = users.find(u => u.email === expectedEmail);

        if (!authUser) {
            console.log('  -> No Auth User found! Ensuring one exists...');
            console.log('  !! CRITICAL: This admin cannot login properly unless they use a different email?');
            continue;
        }

        console.log(`  -> Found Auth User: ${authUser.id}`);

        // Check Link
        if (admin.auth_id !== authUser.id) {
            console.log(`  !! MISMATCH: DB auth_id (${admin.auth_id}) !== Auth user id (${authUser.id})`);
            console.log('  -> Fixing linkage...');

            const { error: updateError } = await supabase
                .from('employees')
                .update({ auth_id: authUser.id })
                .eq('id', admin.id);

            if (updateError) console.error('  -> Fix Failed:', updateError);
            else console.log('  -> Fixed.');
        } else {
            console.log('  -> Linkage OK.');
        }
    }
}

checkLinkage();
