import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkConsistency() {
    const { data: dbManuals } = await supabase.from('device_manuals').select('*');

    const dbFiles = [];
    dbManuals.forEach(manual => {
        if (manual.files && Array.isArray(manual.files)) {
            manual.files.forEach(f => {
                let storageKey = 'UNKNOWN';
                try {
                    const urlObj = new URL(f.url);
                    const pathParts = urlObj.pathname.split('/');
                    storageKey = decodeURIComponent(pathParts[pathParts.length - 1]);
                } catch (e) { }
                dbFiles.push({ manualId: manual.id, name: f.name, key: storageKey, url: f.url });
            });
        }
    });

    const { data: list } = await supabase.storage.from('manuals').list();
    const storageKeys = list ? list.map(f => f.name) : [];

    const mismatches = dbFiles.filter(dbFile => !storageKeys.includes(dbFile.key));

    const report = {
        dbFilesCount: dbFiles.length,
        storageFilesCount: storageKeys.length,
        dbFiles,
        storageKeys,
        mismatches
    };

    fs.writeFileSync('inconsistency-report.json', JSON.stringify(report, null, 2));
    console.log('Report written to inconsistency-report.json');
}
checkConsistency().catch(console.error);
