import { SupabaseClient } from '@supabase/supabase-js';
import { fixOperationLogActor } from './audit_helper';

export type UpsertResult = {
    success: boolean;
    employee?: any;
    authStatus?: string;
    authId?: string;
    error?: string;
    code?: string;
};

export async function upsertEmployeeLogic(supabaseAdmin: SupabaseClient, data: any, actorUser?: any): Promise<UpsertResult> {
    const {
        employee_code,
        email,
        name,
        password,
        name_kana,
        gender,
        birthday,
        join_date,
        age_at_month_end,
        years_in_service,
        months_in_service,
        area_code,
        address_code,
        authority,
        department_code
    } = data;

    try {
        // --- Step 1: Resolve Auth User (Identity Resolution) ---
        let targetAuthId: string | null = null;
        let authAction = 'none';

        // 1-A. Check if Employee exists (Primary Check) - version も取得
        const { data: existingEmployee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, auth_id, email, version')
            .eq('employee_code', employee_code)
            .single();

        if (empError && empError.code !== 'PGRST116') {
            throw new Error(`Database verify failed: ${empError.message}`);
        }

        const isUpdate = !!existingEmployee;
        const currentVersion = existingEmployee?.version || 1;
        const authEmail = email || `${employee_code}@ledger-system.local`;

        if (isUpdate && existingEmployee.auth_id) {
            targetAuthId = existingEmployee.auth_id;
            authAction = 'update_by_id';
        } else {
            // Priority 2: New Employee -> Lookup by Email (Auth Email)
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (listError) throw new Error(`Auth lookup failed: ${listError.message}`);

            const existingAuthUser = users.find(u => u.email?.toLowerCase() === authEmail.toLowerCase());

            if (existingAuthUser) {
                targetAuthId = existingAuthUser.id;
                authAction = 'reuse_existing';
            } else {
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: authEmail,
                    password: password || '12345678',
                    email_confirm: true,
                    user_metadata: { name, employee_code, email: authEmail },
                    app_metadata: { role: authority === 'admin' ? 'admin' : 'user' }
                });

                if (createError) throw new Error(`Auth create failed: ${createError.message}`);
                targetAuthId = newUser.user.id;
                authAction = 'created';
            }
        }

        // --- Step 2: Update Auth User Metadata/Email ---
        if (authAction !== 'created' && targetAuthId) {
            const updates: any = {
                user_metadata: { name, employee_code },
                app_metadata: { role: authority === 'admin' ? 'admin' : 'user' },
                email: authEmail,
                email_confirm: true
            };
            if (password) updates.password = password;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetAuthId, updates);
            if (updateError) throw new Error(`Auth update failed: ${updateError.message}`);
        }

        // --- Step 3: DB Operation (RPC for Update, Insert for New) ---
        let dbResult: any = null;
        let dbError: any = null;

        if (isUpdate) {
            // 更新時は RPC を利用して楽観ロックを適用
            const { data: success, error: rpcError } = await supabaseAdmin.rpc('update_employee_safe', {
                p_id: existingEmployee.id,
                p_version: currentVersion,
                p_employee_code: employee_code,
                p_name: name,
                p_name_kana: name_kana,
                p_email: email,
                p_gender: gender,
                p_birthday: birthday,
                p_join_date: join_date,
                p_area_code: area_code,
                p_address_code: address_code,
                p_authority: authority === 'admin' ? 'admin' : 'user'
            });

            if (rpcError) {
                dbError = rpcError;
            } else if (!success) {
                dbError = { message: 'Conflict: 他のユーザーにより更新されています。', code: '409' };
            } else {
                // 更新後のデータを再取得（Auditログ対応用）
                const { data: updated } = await supabaseAdmin.from('employees').select('*').eq('id', existingEmployee.id).single();
                dbResult = updated;
            }
        } else {
            // 新規登録は直接 INSERT
            const { data, error } = await supabaseAdmin
                .from('employees')
                .insert({
                    employee_code,
                    auth_id: targetAuthId,
                    name,
                    name_kana,
                    email,
                    gender,
                    birthday,
                    join_date,
                    age_at_month_end,
                    years_in_service,
                    months_in_service,
                    area_code,
                    address_code,
                    authority: authority === 'admin' ? 'admin' : 'user',
                })
                .select()
                .single();
            dbResult = data;
            dbError = error;
        }

        if (dbError) {
            if (authAction === 'created' && targetAuthId) {
                try {
                    await supabaseAdmin.auth.admin.deleteUser(targetAuthId);
                } catch (cleanupError) {
                    console.error('Failed to cleanup orphaned Auth User:', cleanupError);
                }
            }

            let jpErrorMessage = `整合性エラー: ${dbError.message}`;
            if (dbError.code === '23505') {
                jpErrorMessage = '登録エラー: 社員コードまたはメールアドレスが既に登録されています。';
            } else if (dbError.code === '409') {
                jpErrorMessage = '競合エラー: 他のユーザーがこの社員情報を更新しました。画面を読み込み直してください。';
            }

            throw new Error(jpErrorMessage);
        }

        // --- Step 4: Fix Audit Log Actor ---
        if (actorUser && dbResult) {
            await fixOperationLogActor(supabaseAdmin, dbResult.id, 'employees', actorUser, isUpdate ? 'UPDATE' : 'INSERT');
        }

        return {
            success: true,
            employee: dbResult,
            authStatus: authAction,
            authId: targetAuthId || undefined,
            code: dbResult.employee_code
        };

    } catch (error: any) {
        return { success: false, error: error.message, code: employee_code };
    }
}
