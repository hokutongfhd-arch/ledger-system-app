
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkSchema() {
    console.log('Checking audit_logs table...');
    const { data, error, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .limit(1);

    if (error) {
        console.error('Error fetching audit_logs:', error);
    } else {
        console.log('Success! Count:', count);
        if (data && data.length > 0) {
            console.log('Sample record columns:', Object.keys(data[0]));
        } else {
            console.log('No records found in audit_logs.');
        }
    }
}

checkSchema();
