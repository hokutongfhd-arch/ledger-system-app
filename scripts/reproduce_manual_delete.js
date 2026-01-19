import { createClient } from '@supabase/supabase-js';

// Run with: node --env-file=.env.local scripts/reproduce_manual_delete.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DOMAIN = 'ledger-system.local';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    console.error('Error: Requied env vars missing.');
    process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
    console.log('--- REPRODUCING MANUAL DELETE ISSUE ---');

    // 1. Get an Admin User
    const { data: emps, error: empError } = await serviceClient
        .from('employees')
        .select('employee_code, password, authority')
        .eq('authority', 'admin')
        .limit(1);

    if (empError || !emps || emps.length === 0) {
        console.error('Failed to get admin user:', empError);
        return;
    }

    const admin = emps[0];
    console.log(`Using Admin: ${admin.employee_code}`);

    // 2. Sign In
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: `${admin.employee_code}@${DOMAIN}`,
        password: admin.password
    });

    if (authError) {
        console.error('Login Failed:', authError);
        return;
    }
    console.log('Login Successful.');
    console.log('User Role in Session:', authData.session.user.app_metadata.role); // Check legacy role
    console.log('User ID:', authData.session.user.id);

    // 3. Create a Test Manual (as Admin)
    const testFiles = [{ name: 'test.pdf', url: 'http://example.com/test.pdf' }, { name: 'keep.pdf', url: 'http://example.com/keep.pdf' }];
    const { data: inserted, error: insertError } = await client
        .from('device_manuals')
        .insert({
            title: 'TEST_MANUAL_DELETE',
            files: testFiles,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (insertError) {
        console.error('INSERT Failed:', insertError);
        // If insert fails, we can't test delete really, but it suggests RLS issue on INSERT too
        return;
    }
    console.log(`Inserted Test Manual ID: ${inserted.id}`);

    // 4. Try UPDATE (Delete one file) - This simulates "File Delete" in UI (which is actually an UPDATE of the files array)
    console.log('Attempting UPDATE (removing one file)...');
    const newFiles = [testFiles[1]]; // Keep one
    const { error: updateError } = await client
        .from('device_manuals')
        .update({
            files: newFiles,
            updated_at: new Date().toISOString()
        })
        .eq('id', inserted.id);

    if (updateError) {
        console.error('UPDATE Failed:', updateError);
        console.log('Checking message for RLS...');
    } else {
        console.log('UPDATE Success! (File deletion simulation pass)');
    }

    // 5. Try DELETE (Delete entire manual)
    console.log('Attempting DELETE (entire manual)...');
    const { error: deleteError } = await client
        .from('device_manuals')
        .delete()
        .eq('id', inserted.id);

    if (deleteError) {
        console.error('DELETE Failed:', deleteError);
    } else {
        console.log('DELETE Success!');
    }
}

run();
