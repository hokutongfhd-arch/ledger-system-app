
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSchema() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing env vars');
        return;
    }
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('employees').select('*').limit(1).single();
    if (error) {
        console.error('Error fetching employee:', error);
    } else {
        console.log('Employee columns:', Object.keys(data));
        console.log('Sample data:', data);
    }
}

checkSchema();
