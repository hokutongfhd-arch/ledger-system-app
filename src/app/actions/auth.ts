'use server';

import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function getLoginEmailAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch Employee Record to get Auth ID
    // We use auth_id because 'email' column might not exist or be empty in DB
    const { data: employee, error } = await supabaseAdmin
        .from('employees')
        .select('auth_id')
        .eq('employee_code', employeeCode)
        .single();

    if (error || !employee || !employee.auth_id) {
        // Return null if not found, allowing client to fallback or fail
        return null;
    }

    // 2. Fetch Auth User by ID to get the Real Email
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(employee.auth_id);

    if (authError || !user) {
        console.warn(`Auth User lookup failed for auth_id ${employee.auth_id}:`, authError);
        return null;
    }

    return user.email;
}

/**
 * ログイン失敗回数の更新処理
 */
export async function handleLoginFailureAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. 登録済み社員かどうかのフラグのみ確認（既存ロジック互換のため）
    const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('employee_code', employeeCode)
        .single();

    // 2. 失敗回数は一律 unknown_login_attempts テーブルで管理する
    // これにより employees テーブルへの更新が発生せず、操作ログ（logs）への不用意な記録を防げる
    const { data: attempt } = await supabaseAdmin
        .from('unknown_login_attempts')
        .select('failed_count')
        .eq('employee_code', employeeCode)
        .single();

    const newCount = (attempt?.failed_count || 0) + 1;

    await supabaseAdmin
        .from('unknown_login_attempts')
        .upsert({
            employee_code: employeeCode,
            failed_count: newCount,
            last_attempt_at: new Date().toISOString()
        });

    return { count: newCount, isRegistered: !!employee };
}

/**
 * ログイン成功時の失敗回数リセット
 */
export async function handleLoginSuccessAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();

    // 失敗カウント用テーブルから該当レコードを削除する
    await supabaseAdmin
        .from('unknown_login_attempts')
        .delete()
        .eq('employee_code', employeeCode);
}
