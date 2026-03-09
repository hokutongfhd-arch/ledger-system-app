const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function deleteAllUsers() {
    console.log('Fetching users to delete...');

    // 権限が user の社員の auth_id と id を取得
    const { data: employees, error: fetchError } = await supabaseAdmin
        .from('employees')
        .select('id, auth_id')
        .eq('authority', 'user');

    if (fetchError) {
        console.error('Error fetching employees:', fetchError);
        return;
    }

    if (!employees || employees.length === 0) {
        console.log('No user-level employees found.');
        return;
    }

    console.log(`Found ${employees.length} employees with "user" authority. Deleting...`);

    let successCount = 0;
    let authDeleteCount = 0;

    for (const emp of employees) {
        // 1. Auth User の削除 (存在する場合のみ)
        if (emp.auth_id) {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(emp.auth_id);
            if (authError) {
                console.error(`Failed to delete auth user ${emp.auth_id}:`, authError.message);
            } else {
                authDeleteCount++;
            }
        }

        // 2. Employee レコードの削除（念のため）
        const { error: empError } = await supabaseAdmin
            .from('employees')
            .delete()
            .eq('id', emp.id);

        if (empError) {
            console.error(`Failed to delete employee record ${emp.id}:`, empError.message);
        } else {
            successCount++;
        }
    }

    console.log(`Finished. Deleted ${successCount} employee records and ${authDeleteCount} auth records.`);
}

deleteAllUsers();
