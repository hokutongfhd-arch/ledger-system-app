import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Setup env and client
config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in env.');
    process.exit(1);
}
// Using anon key to simulate client-side behavior
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false
    }
});

async function testDelete() {
    // We already know some files in storage, let's grab one
    const { data: list, error: listError } = await supabase.storage.from('manuals').list();
    if (listError) console.error("List Error:", listError);
    if (list && list.length > 0) {
        const file = list[0];
        console.log(`Checking file: ${file.name}`);
        const { data, error } = await supabase.storage.from('manuals').remove([file.name]);
        console.log(`Delete returned data:`, data);
        console.log(`Delete returned error:`, error);

        // check if it still exists
        const { data: listAfter } = await supabase.storage.from('manuals').list();
        const exists = listAfter.find(f => f.name === file.name);
        console.log(`Does file still exist in bucket? ${exists ? 'YES!' : 'NO!'}`);
    }
}
testDelete().catch(console.error);
