
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTriggers() {
    console.log('Listing Triggers...');
    const { data, error } = await supabase.rpc('get_table_triggers');

    if (error) {
        console.error('Error fetching triggers:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No triggers found.');
        return;
    }

    console.table(data);

    // Specifically look for audit or log related triggers
    console.log('\n--- Potential Audit/Log Triggers ---');
    data.forEach((t: any) => {
        if (t.trigger_name.includes('audit') || t.trigger_name.includes('log')) {
            console.log(`Table: ${t.table_name}, Trigger: ${t.trigger_name}, Action: ${t.action_statement}`);
        }
    });
}

listTriggers();
