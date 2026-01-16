import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load env vars
function loadEnv(filename) {
    const envPath = path.resolve(rootDir, filename);
    if (fs.existsSync(envPath)) {
        console.log(`Loading env from ${filename}`);
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
                if (!process.env[key]) process.env[key] = value;
            }
        });
    } else {
        console.log(`Env file not found: ${filename}`);
    }
}

loadEnv('.env');
loadEnv('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('--- Debugging Logs Access (ESM) ---');

    // 1. Check Total Logs Count (Service Role Payload)
    const { count: totalLogs, error: logError } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true });

    if (logError) {
        console.error('1. Failed to fetch logs:', logError.message);
    } else {
        console.log(`1. Total Log Entries in DB: ${totalLogs}`);
    }

    // 2. Check Data Sample
    const { data: sample, error: sampleError } = await supabase
        .from('logs')
        .select('id, created_at, operation, actor_name')
        .limit(3);

    if (sampleError) console.error('Sample fetch error:', sampleError.message);
    else console.log('Sample Data:', sample);

    // 3. Check Admins
    const { data: admins, error: adminError } = await supabase
        .from('employees')
        .select('employee_code, name, authority, auth_id')
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
}

run();
