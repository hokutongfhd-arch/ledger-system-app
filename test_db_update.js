import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDbUpdate() {
    console.log("Logging in as user 1107...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: '1107@ledger-system.local',
        password: 'password' // Will use Service Role to bypass login for DB policy test
    });
}
testDbUpdate().catch(console.error);
