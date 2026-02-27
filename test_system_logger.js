import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env block
config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// To test the client side flow properly, let's just insert an error directly using the backend role 
// (though the client uses the anon key and RLS handles it, we can verify RLS works from earlier UI tests).
// Here we just test if the table allows inserts and we can fetch it.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testErrorLog() {
    console.log("Inserting a fake error to system_error_logs...");
    const { error: insertErr } = await supabase.from('system_error_logs').insert({
        error_message: 'Testing Error Logging System',
        error_details: JSON.stringify({ code: 'TEST_ERR', reason: 'Verification' }),
        context: 'test_system_logger.js script',
    });

    if (insertErr) {
        console.error("Failed to insert log! Check policies or schema: ", insertErr);
        return;
    }

    console.log("Success! Fetching the log back...");
    const { data: logs, error: fetchErr } = await supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (fetchErr) {
        console.error("Failed to fetch logs:", fetchErr);
    } else {
        console.log("Latest log in DB:", logs[0]);
    }
}
testErrorLog().catch(console.error);
