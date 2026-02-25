import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function checkConstraints() {
    console.log('--- Checking UNIQUE Constraints ---');
    const { data: constraints, error } = await supabase.rpc('get_constraints');
    
    if (error) {
        // If RPC doesn't exist, try direct query via postgrest if allowed, 
        // but typically information_schema is not exposed to Postgrest unless explicitly allowed.
        // Let's try to fetch from a meta-table if it exists or use a raw SQL approach if I can.
        console.error('RPC get_constraints failed. Attempting direct SQL via anon-functional check...');
        
        // Alternative: try to insert a duplicate and see if it fails with 23505.
        // But better to define an RPC to check schema.
        console.log('Please run the following SQL in Supabase SQL Editor to verify:');
        console.log(`
            SELECT
                conname AS constraint_name,
                contype AS constraint_type,
                relname AS table_name,
                array_agg(attname) AS columns
            FROM pg_constraint c
            JOIN pg_class r ON c.conrelid = r.oid
            JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = ANY(c.conkey)
            WHERE contype = 'u'
            GROUP BY conname, contype, relname;
        `);
        return;
    }
    
    console.table(constraints);
}

checkConstraints();
