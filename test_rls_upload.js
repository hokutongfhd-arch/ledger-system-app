import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // User anon key!

async function testUploadFailed() {
    console.log("Testing upload with anon key, which should hit the authenticated-only RLS policy...");
    // Let's try uploading a dummy text file
    const fileContent = new Blob(['hello world'], { type: 'text/plain' });
    const { data, error } = await supabase.storage.from('manuals').upload(`test_rls_failure_${Date.now()}.txt`, fileContent);

    console.log("Upload response data:", data);
    console.log("Upload response error:", error);
}
testUploadFailed().catch(console.error);
