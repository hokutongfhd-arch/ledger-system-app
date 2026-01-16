import { createClient } from '@supabase/supabase-js';

const userProvidedKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltb2dpeGFqc3FrYXRvaXhrd2xjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTMxMywiZXhwIjoyMDgxMDY3MzEzfQ.oAgev4qVpElBeCHrTO6cZhL0A1ZZSkxlu_M1otPlKQ0";
const derivedUrl = "https://imogixajsqkatoixkwlc.supabase.co";

const supabase = createClient(derivedUrl, userProvidedKey);

async function run() {
    console.log('--- LOG ENTRIES ---');
    const { data: logs, error } = await supabase
        .from('logs')
        .select('id, created_at, is_archived, operation, actor_name')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Fetch error:', error);
    } else {
        logs.forEach(log => {
            console.log(JSON.stringify(log));
        });

        console.log('\n--- COUNTS ---');
        const { count: total } = await supabase.from('logs').select('*', { count: 'exact', head: true });
        console.log(`Total: ${total}`);
    }
}

run();
