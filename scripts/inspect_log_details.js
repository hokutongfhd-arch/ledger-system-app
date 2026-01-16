import { createClient } from '@supabase/supabase-js';

const userProvidedKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltb2dpeGFqc3FrYXRvaXhrd2xjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTMxMywiZXhwIjoyMDgxMDY3MzEzfQ.oAgev4qVpElBeCHrTO6cZhL0A1ZZSkxlu_M1otPlKQ0";
const derivedUrl = "https://imogixajsqkatoixkwlc.supabase.co";

console.log('--- Inspecting Log Details ---');
const supabase = createClient(derivedUrl, userProvidedKey);

async function run() {
    try {
        const { data: logs, error } = await supabase
            .from('logs')
            .select('id, created_at, is_archived, operation, actor_name')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Fetch Failed:', error.message);
        } else {
            console.log(`Found ${logs.length} logs.`);
            console.log('--- Data ---');
            console.table(logs);

            // Check counts
            const { count: archivedCount } = await supabase.from('logs').select('*', { count: 'exact', head: true }).eq('is_archived', true);
            const { count: activeCount } = await supabase.from('logs').select('*', { count: 'exact', head: true }).eq('is_archived', false);

            console.log('\n--- Summary ---');
            console.log(`Archived (is_archived=true): ${archivedCount}`);
            console.log(`Active (is_archived=false): ${activeCount}`);

            const now = new Date();
            console.log(`Current Time (Server/Script): ${now.toISOString()}`);
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
}

run();
