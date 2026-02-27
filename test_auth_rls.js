import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuthUpload() {
    console.log("Logging in as user 1107...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: '1107@ledger-system.local',
        password: 'password'
    });

    if (authError) {
        console.error("Login failed:", authError);
        return;
    }
    console.log("Login successful! Session Active.");

    console.log("Testing upload...");
    const fileContent = new Blob(['hello world'], { type: 'text/plain' });
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('manuals')
        .upload(`test_auth_rls_${Date.now()}.txt`, fileContent);

    console.log("Upload Data:", uploadData);
    console.log("Upload Error:", uploadError);
    if (uploadError) return;

    console.log("Testing delete...");
    const { data: delData, error: delError } = await supabase.storage
        .from('manuals')
        .remove([uploadData.path]);

    console.log("Delete Data:", delData);
    console.log("Delete Error:", delError);
}
testAuthUpload().catch(console.error);
