import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const userProvidedKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imltb2dpeGFqc3FrYXRvaXhrd2xjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTQ5MTMxMywiZXhwIjoyMDgxMDY3MzEzfQ.oAgev4qVpElBeCHrTO6cZhL0A1ZZSkxlu_M1otPlKQ0";

const envPath = path.resolve(process.cwd(), '.env.local');

console.log('--- Checking .env.local ---');
console.log(`Looking for file at: ${envPath}`);

let localKey = '';
let localUrl = '';

if (fs.existsSync(envPath)) {
    console.log('File found.');
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
            if (key === 'SUPABASE_SERVICE_ROLE_KEY') localKey = value;
            if (key === 'NEXT_PUBLIC_SUPABASE_URL') localUrl = value;
        }
    });
} else {
    console.error('ERROR: .env.local file NOT found!');
}

console.log(`\nURL in .env.local: ${localUrl}`);
console.log(`Key in .env.local: ${localKey ? (localKey.substring(0, 10) + '...' + localKey.slice(-10)) : 'NOT FOUND'}`);
console.log(`User provided Key: ${userProvidedKey.substring(0, 10) + '...' + userProvidedKey.slice(-10)}`);

if (localKey === userProvidedKey) {
    console.log('\nSUCCESS: Keys MATCH.');
} else {
    console.error('\nFAIL: Keys DO NOT MATCH.');
    console.log('Please update .env.local with the key you provided.');
}

console.log('\n--- Testing Connection with User Provided Key ---');
if (!localUrl) {
    console.error('Cannot test connection: URL missing.');
} else {
    const supabase = createClient(localUrl, userProvidedKey);

    // Check Logs
    const { data, error, count } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Connection Test Failed:', error.message);
        if (error.code) console.error('Error Code:', error.code);
    } else {
        console.log('Connection Test SUCCESS!');
        console.log(`Total Logs in DB: ${count}`);
    }
}
