import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env block
config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchLatestLog() {
    console.log("Fetching the latest system log to verify Japanese output...");
    const { data: logs, error: fetchErr } = await supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (fetchErr) {
        console.error("Failed to fetch logs:", fetchErr);
    } else {
        console.log("Latest log in DB:", JSON.stringify(logs[0], null, 2));
    }
}
fetchLatestLog().catch(console.error);
