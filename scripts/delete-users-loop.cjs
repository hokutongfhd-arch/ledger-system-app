const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllUsers() {
    console.log('Starting cleanup of all "user" authority accounts...');

    let totalDeleted = 0;
    let keepGoing = true;

    while (keepGoing) {
        // 1000件ずつ取得
        const { data: employees, error: fetchError } = await supabaseAdmin
            .from('employees')
            .select('id, auth_id')
            .eq('authority', 'user')
            .limit(1000);

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            break;
        }

        if (!employees || employees.length === 0) {
            console.log('No more users found.');
            keepGoing = false;
            break;
        }

        console.log(`Processing batch of ${employees.length} users...`);

        let batchDeleted = 0;
        // 1件ずつ auth を削除（カスケードでemployeeも消えるはず）
        for (const emp of employees) {
            if (emp.auth_id) {
                // RPCを使って強制削除
                const { error: rpcError } = await supabaseAdmin.rpc('force_delete_auth_user', { target_user_id: emp.auth_id });
                if (rpcError) {
                    // 通常のadmin削除でフォールバック
                    await supabaseAdmin.auth.admin.deleteUser(emp.auth_id);
                }
            }

            // employee単体も念のため削除
            await supabaseAdmin.from('employees').delete().eq('id', emp.id);

            batchDeleted++;
        }

        totalDeleted += batchDeleted;
        console.log(`...Deleted ${batchDeleted} users in this batch. Total so far: ${totalDeleted}`);
    }

    console.log(`Finished! Total deleted: ${totalDeleted}`);
}

deleteAllUsers();
