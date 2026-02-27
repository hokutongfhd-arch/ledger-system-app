import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using the actual admin key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixInconsistency() {
    console.log('Fetching Storage list...');
    const { data: list } = await supabase.storage.from('manuals').list();
    const storageKeys = list ? list.map(f => f.name) : [];

    console.log('Fetching DB Manuals...');
    const { data: dbManuals } = await supabase.from('device_manuals').select('*');

    for (const manual of dbManuals) {
        if (!manual.files || !Array.isArray(manual.files)) continue;

        let needsUpdate = false;
        const newFiles = manual.files.filter(f => {
            let storageKey = 'UNKNOWN';
            try {
                const urlObj = new URL(f.url);
                const pathParts = urlObj.pathname.split('/');
                storageKey = decodeURIComponent(pathParts[pathParts.length - 1]);
            } catch (e) { }

            if (storageKeys.includes(storageKey)) {
                return true;
            } else {
                console.log(`Removing orphaned DB file reference: ${f.name} (Key: ${storageKey})`);
                needsUpdate = true;
                return false;
            }
        });

        if (needsUpdate) {
            if (newFiles.length === 0) {
                console.log(`Deleting entire manual record ID ${manual.id} because all its files are gone.`);
                const { error, count } = await supabase.from('device_manuals').delete({ count: 'exact' }).eq('id', manual.id);
                if (error) console.error("Error deleting:", error);
                else console.log(`Deleted ${count} DB row(s).`);
            } else {
                console.log(`Updating manual record ID ${manual.id} with valid files only.`);
                const { error, count } = await supabase.from('device_manuals').update({ files: newFiles }, { count: 'exact' }).eq('id', manual.id);
                if (error) console.error("Error updating:", error);
                else console.log(`Updated ${count} DB row(s).`);
            }
        }
    }
    console.log('Consistency fix complete.');
}
fixInconsistency().catch(console.error);
