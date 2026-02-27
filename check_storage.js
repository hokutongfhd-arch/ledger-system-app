import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Setup env and client
config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in env.');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkStorage() {
    const { data: list, error: listError } = await supabase.storage.from('manuals').list();
    if (listError) console.error("List Error:", listError);
    if (list) {
        console.log(`There are ${list.length} files in Storage.`);
        // Looking for the file the subagent just deleted: "週2026.1.19.pdf" or its random string equivalent
        const deletedOriginal = "週2026.1.19.pdf";

        // Let's also check the DB to see how many manuals are left
        const { data: dbManuals } = await supabase.from('device_manuals').select('id, title, files');
        let totalDbFiles = 0;
        dbManuals.forEach(m => {
            if (m.files && Array.isArray(m.files)) totalDbFiles += m.files.length;
        });
        console.log(`There are ${totalDbFiles} files referenced in the Database.`);

        // Find orphaned files
        const registeredFileNames = new Set();
        dbManuals.forEach(manual => {
            if (manual.files && Array.isArray(manual.files)) {
                manual.files.forEach(file => {
                    if (file.url) {
                        try {
                            const urlObj = new URL(file.url);
                            const pathParts = urlObj.pathname.split('/');
                            const storageFileName = decodeURIComponent(pathParts[pathParts.length - 1]);
                            registeredFileNames.add(storageFileName);
                        } catch (e) { }
                    }
                });
            }
        });

        const orphaned = list.filter(f => f.name !== '.emptyFolderPlaceholder' && !registeredFileNames.has(f.name));
        console.log(`There are ${orphaned.length} orphaned files in Storage:`);
        orphaned.forEach(o => console.log(` - ${o.name}`));
    }
}
checkStorage().catch(console.error);
