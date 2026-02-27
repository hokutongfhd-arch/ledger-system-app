import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificFile() {
    const { data: list, error } = await supabase.storage.from('manuals').list();
    if (error) {
        console.error("Error listing files:", error);
        return;
    }

    console.log(`Total files in storage using Service Role (bypassing RLS): ${list.length}`);
    const specificFile = list.find(f => f.name.includes('1772165940784'));
    if (specificFile) {
        console.log("FOUND IT! Yes, the file DID upload, but the user couldn't delete it due to RLS.");
    } else {
        console.log("NOT FOUND. The file didn't even upload, or it was deleted.");
    }

    const { data: dbData } = await supabase.from('device_manuals').select('*');
    let foundInDb = false;
    dbData.forEach(manual => {
        if (manual.files && Array.isArray(manual.files)) {
            manual.files.forEach(f => {
                if (f.url && f.url.includes('1772165940784')) {
                    console.log(`FOUND in DB under manual ID: ${manual.id}, title: ${manual.title}`);
                    foundInDb = true;
                }
            });
        }
    });

}
checkSpecificFile().catch(console.error);
