import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manually load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
            process.env[key] = value;
        }
    });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
    console.error('Missing env vars: URL or SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

async function checkLogs() {
    console.log('Checking connection and logs table...');

    // 1. Check if we can fetch ANY logs
    const { data: logs, error, count } = await supabase
        .from('logs')
        .select('*', { count: 'exact' })
        .limit(5);

    if (error) {
        console.error('Error fetching logs:', error);
    } else {
        console.log(`Successfully fetched logs. Total count in DB: ${count}`);
        console.log('Sample logs count:', logs ? logs.length : 0);
        if (logs && logs.length > 0) {
            console.log('Sample log:', logs[0]);
        }
    }

    // 2. Check Archive counts
    const { count: archivedCount, error: archiveError } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', true);

    if (archiveError) {
        console.error('Error fetching archived logs:', archiveError);
    } else {
        console.log(`Archived logs count: ${archivedCount}`);
    }

    // 3. Check Active counts
    const { count: activeCount, error: activeError } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false);

    if (activeError) {
        console.error('Error fetching active logs:', activeError);
    } else {
        console.log(`Active logs count: ${activeCount}`);
    }
}

checkLogs();
