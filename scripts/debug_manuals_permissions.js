import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
            if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = value;
            if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
        }
    });
}

if (!serviceKey || !supabaseUrl) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function inspect() {
    console.log('--- Inspecting Policies on device_manuals ---');
    // We can't query pg_policies easily via JS client unless we have a helper or SQL function.
    // Instead, we'll check the employees table to see if admins are set up correctly.

    console.log('\n--- Checking Employees Table (Admins) ---');
    const { data: admins, error: adminError } = await supabase
        .from('employees')
        .select('id, employee_code, name, authority, auth_id')
        .eq('authority', 'admin');

    if (adminError) {
        console.error('Error fetching admins:', adminError);
    } else {
        console.table(admins);
        const unlinkedAdmins = admins.filter(a => !a.auth_id);
        if (unlinkedAdmins.length > 0) {
            console.warn('WARNING: The following admins have NO auth_id linked:', unlinkedAdmins.map(a => a.name));
        } else {
            console.log('All admins have an auth_id.');
        }
    }

    console.log('\n--- Checking Device Manuals RLS Enabled? ---');
    // Attempt to query as anon - should get result (SELECT policy)
    // Attempt to update as anon - should fail
}

inspect();
