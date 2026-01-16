const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars
function loadEnv(filename) {
    const envPath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
                if (!process.env[key]) process.env[key] = value;
            }
        });
    }
}

loadEnv('.env');
loadEnv('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('URL:', url ? 'Set' : 'Missing');
    console.log('KEY:', key ? 'Set' : 'Missing');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('--- Debugging Logs Access ---');

    // 1. Check Total Logs Count (Service Role Payload)
    const { count: totalLogs, error: logError } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true });

    if (logError) {
        console.error('1. Failed to fetch logs:', logError.message);
    } else {
        console.log(`1. Total Log Entries in DB: ${totalLogs}`);
    }

    // 2. Check Admins
    const { data: admins, error: adminError } = await supabase
        .from('employees')
        .select('id, employee_code, name, authority, auth_id')
        .eq('authority', 'admin');

    if (adminError) {
        console.error('2. Failed to fetch admins:', adminError.message);
    } else {
        console.log(`2. Found ${admins ? admins.length : 0} Admins:`);
        if (admins) {
            admins.forEach(a => {
                console.log(`   - ${a.name} (${a.employee_code}): AuthID=${a.auth_id}, Authority=${a.authority}`);
            });
        }
    }

    // 3. Check is_admin() function definition (indirectly by testing if an admin can select)
    // We can't strictly test RLS as a specific user easily without their token.
    // However, if we have local code issues, this confirms DB state is healthy.
}

run();
