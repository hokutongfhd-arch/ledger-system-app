import { createClient } from '@supabase/supabase-js';

// Read from .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: Env vars missing');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function debugRLS() {
    // Replace with the credentials of the admin user having issues
    // Since I don't know the password, I'll rely on the user to run this or edit it.
    // Or I can use a known test user if one exists.
    // Wait, I can't know the password.

    // Alternative: Use Service Role to fetch a user, then ... wait, I can't impersonate without password for `signIn`.
    // But I can verify the metadata of the user using Admin API.

    // Let's inspect the Metadata of a specific user (e.g. 'marui-1107' - assuming that's the code from screenshot).

    const adminClient = createClient(
        SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Fetch the user info
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    if (error) {
        console.error('List users failed:', error);
        return;
    }

    console.log('--- Inspecting Admin Metadata ---');
    const admins = users.filter(u => u.app_metadata.role === 'admin');
    console.log(`Found ${admins.length} users with app_metadata.role = 'admin'`);

    admins.forEach(u => {
        console.log(`User: ${u.email} (ID: ${u.id})`);
        console.log(`  app_metadata:`, u.app_metadata);
        console.log(`  user_metadata:`, u.user_metadata);
    });

    console.log('---------------------------------');
    // If metadata looks correct here, then the issue is the Policy definition itself or the "Claims" not being refreshed in the browser session.

    // Check Policy Definition (can't query pg_policies easily from here without SQL Editor).
    // But I can try to recreate the policy to be absolutely sure.
}

debugRLS();
