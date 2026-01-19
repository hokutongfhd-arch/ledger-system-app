
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const envConfig = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/"/g, ''); // Simple cleanup
        envConfig[key] = value;
    }
});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
// console.log('Key:', supabaseKey); // Don't log key

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking device_manuals schema...');

    // Try to select display_order
    const { data, error } = await supabase
        .from('device_manuals')
        .select('id, title, display_order')
        .limit(1);

    if (error) {
        if (error.message.includes('column "display_order" does not exist')) {
            console.log('Column display_order DOES NOT exist.');
        } else {
            console.log('Error fetching data (likely missing column):', error.message);
            console.log('Column display_order DOES NOT exist.');
        }
    } else {
        console.log('Column display_order EXISTS.');
    }
}

checkSchema();
