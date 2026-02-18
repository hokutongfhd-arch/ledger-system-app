
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployee() {
    const code = '1107';
    console.log(`Checking for employee with code: "${code}"`);

    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_code', code);

    if (error) {
        console.error('Error fetching employee:', error);
    } else {
        console.log('Employee Data:', data);
    }

    // Also check for leading/trailing whitespace or padding
    const { data: likeData, error: likeError } = await supabase
        .from('employees')
        .select('*')
        .like('employee_code', `%${code}%`);

    if (likeError) {
        console.error('Error likely fetching employee:', likeError);
    } else {
        console.log('Like Match Data:', likeData);
    }
}

checkEmployee();
