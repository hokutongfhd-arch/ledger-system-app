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

export async function upsertEmployeeLogic(
    supabaseAdmin: SupabaseClient,
    data: any,
    actorUser?: any,
    authCache?: Map<string, string>, // email -> id
    mode: 'strict' | 'upsert' = 'upsert'
): Promise<UpsertResult> {
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

        // 厳格モードの場合、既存の社員（コード重複）が見つかったらエラー
        if (mode === 'strict' && isUpdate) {
            return {
                success: false,
                error: `登録エラー: 社員コード「${employee_code}」は既に登録されています。`,
                code: employee_code
            };
        }
        const currentVersion = existingEmployee?.version || 1;

        // メールアドレスは必須。空の場合はエラーとして処理する
        if (!email || !email.trim()) {
            return {
                success: false,
                error: '登録エラー: メールアドレスは必須です。',
                code: employee_code
            };
        }
        const authEmail = email.trim().toLowerCase();

        if (isUpdate && existingEmployee.auth_id) {
            targetAuthId = existingEmployee.auth_id;
            authAction = 'update_by_id';
        } else {
            // まず新規作成を試みる（6000件超でも listUsers の1000件制限に依存しない）
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: authEmail,
                password: password || '12345678',
                email_confirm: true,
                user_metadata: { name, employee_code, email: authEmail },
                app_metadata: { role: authority === 'admin' ? 'admin' : 'user' }
            });

            if (!createError) {
                // 新規作成成功
                targetAuthId = newUser.user.id;
                authAction = 'created';
            } else if (
                createError.message?.toLowerCase().includes('already') ||
                createError.message?.toLowerCase().includes('registered') ||
                (createError as any).status === 422
            ) {
                // メールアドレスが既に Auth に存在する場合：DB 経由で auth_id を検索
                const { data: existingEmpByEmail } = await supabaseAdmin
                    .from('employees')
                    .select('auth_id')
                    .ilike('email', authEmail)
                    .not('auth_id', 'is', null)
                    .limit(1)
                    .single();

                if (existingEmpByEmail?.auth_id) {
                    targetAuthId = existingEmpByEmail.auth_id;
                    authAction = 'reuse_existing';
                } else {
                    // DB に auth_id がない場合は、Auth から検索して紐付けを試みる
                    // ユーザー数が多い（8500件超）環境では非常に低速になるため、一度で見つかるよう検索
                    let page = 1;
                    let found = false;

                    // 1. キャッシュがあればそれを利用
                    if (authCache && authCache.has(authEmail)) {
                        targetAuthId = authCache.get(authEmail)!;
                        authAction = 'reuse_existing';
                        found = true;
                    }

                    // 2. キャッシュに無い場合はフォールバックとして Auth API を叩く
                    while (!found) {
                        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
                        if (listError) throw new Error(`Auth lookup failed: ${listError.message}`);
                        
                        const match = users.find(u => u.email?.toLowerCase() === authEmail);
                        if (match) {
                            targetAuthId = match.id;
                            authAction = 'reuse_existing';
                            found = true;
                        }
                        if (users.length < 1000) break;
                        page++;
                    }
                    
                    if (!found) {
                         throw new Error(`Auth lookup failed: email ${authEmail} が Auth に見つかりません`);
                    }
                }
            } else {
                throw new Error(`Auth create failed: ${createError.message}`);
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
            // 更新時は直接 UPDATE で楽観ロックを適用（version が一致する行のみ更新）
            const { data: updatedData, error: updateError } = await supabaseAdmin
                .from('employees')
                .update({
                    employee_code,
                    name,
                    name_kana,
                    email,
                    gender,
                    birthday: birthday || null,
                    join_date: join_date || null,
                    area_code,
                    address_code,
                    authority: authority === 'admin' ? 'admin' : 'user',
                    version: currentVersion + 1,
                })
                .eq('id', existingEmployee.id)
                .eq('version', currentVersion) // 楽観ロック: バージョンが一致する場合のみ更新
                .select()
                .single();

            if (updateError) {
                dbError = updateError;
            } else if (!updatedData) {
                dbError = { message: 'Conflict: 他のユーザーにより更新されています。', code: '409' };
            } else {
                dbResult = updatedData;
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
