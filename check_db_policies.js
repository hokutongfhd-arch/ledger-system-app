import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicies() {
    const { data } = await supabase.from('device_manuals').select('*').limit(1);
    console.log("Device manuals accessible:", !!data);

    // Get policies for device_manuals using raw SQL
    // Actually we can just run a raw query using rpc or just check if update works
    console.log("Checking if device_manuals has an RLS policy blocking updates?");
}
checkPolicies().catch(console.error);
