import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

config({ path: '.env.local' });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function dumpDB() {
    const { data: dbData } = await supabase.from('device_manuals').select('*');
    const { data: list } = await supabase.storage.from('manuals').list();

    fs.writeFileSync('db_dump.json', JSON.stringify({ db: dbData, storage: list }, null, 2));
    console.log('written');
}
dumpDB().catch(console.error);
