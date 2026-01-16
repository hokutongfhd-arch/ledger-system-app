import { createClient } from '@supabase/supabase-js';

const userProvidedKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltb2dpeGFqc3FrYXRvaXhrd2xjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTMxMywiZXhwIjoyMDgxMDY3MzEzfQ.oAgev4qVpElBeCHrTO6cZhL0A1ZZSkxlu_M1otPlKQ0";
// Derived from JWT 'ref' claim: imogixajsqkatoixkwlc
const derivedUrl = "https://imogixajsqkatoixkwlc.supabase.co";

console.log('--- Verifying Provided Key & URL ---');
console.log(`URL: ${derivedUrl}`);
console.log(`Key: ${userProvidedKey.substring(0, 10)}...`);

const supabase = createClient(derivedUrl, userProvidedKey);

async function run() {
    try {
        console.log('Attempting to fetch logs...');
        const { data, error, count } = await supabase
            .from('logs')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Connection Failed:', error.message);
            if (error.code) console.error('Error Code:', error.code);
        } else {
            console.log('SUCCESS: Connection Verified!');
            console.log(`Total Logs in DB: ${count}`);
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
}

run();
