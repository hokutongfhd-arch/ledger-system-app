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

        // Use real email for Auth if provided, otherwise fallback to Code-based email
        const authEmail = email || `${employee_code}@ledger-system.local`;

        // 1-A. Check if Employee exists (Primary Check)
        const { data: existingEmployee, error: empError } = await supabaseAdmin
            .from('employees')
            .select('id, auth_id, email')
            .eq('employee_code', employee_code)
            .single();

        if (empError && empError.code !== 'PGRST116') {
            throw new Error(`Database verify failed: ${empError.message}`);
        }

        if (existingEmployee && existingEmployee.auth_id) {
            // Priority 1: Use existing connection
            targetAuthId = existingEmployee.auth_id;
            authAction = 'update_by_id';
        } else {
            // Priority 2: New Employee -> Lookup by Email (Auth Email)
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (listError) throw new Error(`Auth lookup failed: ${listError.message}`);

            const existingAuthUser = users.find(u => u.email?.toLowerCase() === authEmail.toLowerCase());

            if (existingAuthUser) {
                // Priority 3: Reuse existing Auth User
                targetAuthId = existingAuthUser.id;
                authAction = 'reuse_existing';
            } else {
                // Priority 4: Create New Auth User
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: authEmail,
                    password: password || '12345678',
                    email_confirm: true,
                    user_metadata: { name, employee_code, email: authEmail }, // Store email in metadata too
                    app_metadata: { role: authority === 'admin' ? 'admin' : 'user' }
                });

                if (createError) throw new Error(`Auth create failed: ${createError.message}`);
                targetAuthId = newUser.user.id;
                authAction = 'created';
            }
        }

        // --- Step 2: Update Auth User Metadata/Email ---
        if (authAction !== 'created' && targetAuthId) {
            console.log(`[Upsert] Updating Auth User ${targetAuthId} with Role: ${authority}`);
            const updates: any = {
                user_metadata: { name, employee_code },
                app_metadata: { role: authority === 'admin' ? 'admin' : 'user' },
                email: authEmail,
                email_confirm: true
            };
            // Always update email to match current requirement
            if (password) updates.password = password;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                targetAuthId,
                updates
            );
            if (updateError) {
                console.error(`[Upsert] Auth update failed: ${updateError.message}`);
                throw new Error(`Auth update failed: ${updateError.message}`);
            } else {
                console.log(`[Upsert] Auth update success for ${targetAuthId}`);
            }
        }

        // --- Step 3: Upsert Employee Record ---
        const employeeData = {
            employee_code,
            auth_id: targetAuthId,
            name,
            name_kana,
            email, // Save real email to DB
            gender,
            birthday,
            join_date,
            age_at_month_end,
            years_in_service,
            months_in_service,
            area_code,
            address_code,
            authority: authority === 'admin' ? 'admin' : 'user',
        };

        // Use supabaseAdmin (Service Role) to bypass RLS and avoid infinite recursion
        const { data: upsertResult, error: upsertError } = await supabaseAdmin
            .from('employees')
            .upsert(employeeData, { onConflict: 'employee_code' })
            .select()
            .single();

        if (upsertError) {
            // Compensation: If we just created an Auth User but DB failed, delete the Auth User to prevent orphans.
            if (authAction === 'created' && targetAuthId) {
                console.warn(`Rolling back Auth User ${targetAuthId} due to DB error.`);
                try {
                    await supabaseAdmin.auth.admin.deleteUser(targetAuthId);
                } catch (cleanupError) {
                    console.error('Failed to cleanup orphaned Auth User:', cleanupError);
                }
            }

            let jpErrorMessage = `DB登録エラー: ${upsertError.message}`;
            if (upsertError.message.includes('infinite recursion')) {
                jpErrorMessage = 'システムエラー: 権限設定の無限ループが発生しました。データベースの修正(is_admin関数の更新)が必要です。';
            } else if (upsertError.message.includes('row-level security policy')) {
                jpErrorMessage = '権限エラー: データの書き込み権限がありません。';
            } else if (upsertError.message.includes('duplicate key')) {
                jpErrorMessage = '登録エラー: 既に登録されているデータと重複しています。';
            }

            throw new Error(jpErrorMessage);
        }

        // --- Step 4: Fix Audit Log Actor ---
        // Since we used Service Role, the Trigger created a log with 'System' or unknown actor.
        // We manually patch it to the actual user who requested the import.
        if (actorUser && upsertResult) {
            // We fire this asynchronously to not block the response too much, 
            // or await it if we want to be sure. Await is safer for "one by one" logic.
            // 1. Fix Audit Log (System Events) -> REMOVED.
            // User requested to separate Audit/Operation logs. 
            // Audit Log should NOT record data manipulation. 
            // If a Trigger creates it, we cannot stop it from here easily, but we shouldn't "fix" it (embellish it) either.
            // Ideally, we drop the trigger.

            // 2. Fix Operation Log (Data Changes)
            await fixOperationLogActor(supabaseAdmin, upsertResult.id, 'employees', actorUser, existingEmployee ? 'UPDATE' : 'INSERT');
        }

        return {
            success: true,
            employee: upsertResult,
            authStatus: authAction,
            authId: targetAuthId || undefined,
            code: upsertResult.employee_code
        };

    } catch (error: any) {
        return { success: false, error: error.message, code: employee_code };
    }
}
