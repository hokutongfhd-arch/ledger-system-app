import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function runDiagnostic() {
    console.log('--- Applying Diagnostic Migration ---');
    const sql = fs.readFileSync(resolve(process.cwd(), 'supabase/migrations/20260225_check_constraints.sql'), 'utf8');
    
    // Note: Suapbase JS client doesn't support arbitrary SQL execution directly.
    // We assume the user runs the SQL or we try to use an existing RPC if available.
    // Since I can't run the SQL directly through the client, I'll ask the user to confirm 
    // or I'll try to call the RPC assuming it was applied in a previous turn (if possible).
    
    console.log('Calling check_db_constraints()...');
    const { data, error } = await supabase.rpc('check_db_constraints');
    
    if (error) {
        console.error('Error calling check_db_constraints:', error.message);
        console.log('Please ensure 20260225_check_constraints.sql is applied in the SQL Editor.');
        return;
    }
    
    console.log('--- Found UNIQUE Constraints ---');
    console.table(data);
}

runDiagnostic();
