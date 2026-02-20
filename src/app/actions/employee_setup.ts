'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'is_initial_setup';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function createEmployeeBySetupAdmin(data: any) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') {
        throw new Error('Unauthorized');
    }

    const supabase = getSupabaseAdmin();

    // 1. Data mapping (similar to mapEmployeeToDb but on server)
    const dbItem = {
        employee_code: data.code,
        auth_id: data.auth_id,
        name: data.name,
        name_kana: data.nameKana,
        gender: data.gender,
        birthday: data.birthDate,
        join_date: data.joinDate,
        age_at_month_end: data.age ? Number(data.age) : 0,
        years_in_service: data.yearsOfService ? Number(data.yearsOfService) : 0,
        months_in_service: data.monthsHasuu ? Number(data.monthsHasuu) : 0,
        area_code: data.areaCode,
        address_code: data.addressCode,
        authority: data.role,
        email: data.email, // Added email
    };

    const { data: result, error } = await supabase
        .from('employees')
        .insert(dbItem)
        .select()
        .single();

    if (error) {
        console.error('DB Insert Error (Setup Admin):', error);
        throw error;
    }

    return result;
}

export async function updateEmployeeBySetupAdmin(item: any) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') throw new Error('Unauthorized');

    const supabase = getSupabaseAdmin();

    // 1. Fetch current data to detect changes and get Auth ID
    const { data: currentEmp, error: fetchError } = await supabase
        .from('employees')
        .select('auth_id, email')
        .eq('id', item.id)
        .single();
    
    if (fetchError) throw new Error(`社員情報の取得に失敗しました: ${fetchError.message}`);

    const newEmail = item.email;
    const oldEmail = currentEmp.email;
    const authId = currentEmp.auth_id;
    let authUpdated = false;

    // 2. Update Auth User if email changed
    if (authId && newEmail && newEmail !== oldEmail) {
        const { error: authError } = await supabase.auth.admin.updateUserById(authId, { email: newEmail });
        if (authError) {
            console.error('Setup Auth Email Update Error:', authError);
            throw new Error(`Authメールアドレスの更新に失敗したため、処理を中断しました: ${authError.message}`);
        }
        authUpdated = true;
    }

    const dbItem = {
        employee_code: item.code,
        name: item.name,
        name_kana: item.nameKana,
        gender: item.gender,
        birthday: item.birthDate,
        join_date: item.joinDate,
        age_at_month_end: Number(item.age) || 0,
        years_in_service: Number(item.yearsOfService) || 0,
        months_in_service: Number(item.monthsHasuu) || 0,
        area_code: item.areaCode,
        address_code: item.addressCode,
        authority: item.role,
        email: item.email, // Added email
    };

    // 3. Update DB
    const { error: dbError } = await supabase.from('employees').update(dbItem).eq('id', item.id);
    
    // 4. Rollback Auth if DB failed
    if (dbError) {
        if (authUpdated && authId && oldEmail) {
            console.warn(`DB update failed, rolling back Auth email for ${authId} to ${oldEmail}`);
            const { error: rollbackError } = await supabase.auth.admin.updateUserById(authId, { email: oldEmail });
            if (rollbackError) {
                console.error('CRITICAL: Auth Email Rollback Failed:', rollbackError);
                // We might want to include this in the error message
                throw new Error(`DB更新に失敗し、Auth情報の復元にも失敗しました。管理者に連絡してください。 DB Error: ${dbError.message}, Rollback Error: ${rollbackError.message}`);
            }
        }
        throw dbError;
    }
}

export async function deleteEmployeeBySetupAdmin(id: string) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') throw new Error('Unauthorized');

    const supabase = getSupabaseAdmin();

    // 1. Get Auth ID
    const { data: employee } = await supabase.from('employees').select('auth_id').eq('id', id).single();

    // 2. Unlink Auth ID (to bypass FK Restrict from employees table)
    if (employee?.auth_id) {
        // Set auth_id to NULL
        const { error: unlinkError } = await supabase
            .from('employees')
            .update({ auth_id: null })
            .eq('id', id);

        if (unlinkError) {
            console.error('Setup Unlink Error:', unlinkError);
            throw new Error(`DB更新エラー(Unlink): ${unlinkError.message}`);
        }

        // 3. Delete Auth User using RPC (to bypass FKs from other tables like logs)
        const { error: authError } = await supabase.rpc('force_delete_auth_user', { target_user_id: employee.auth_id });
        if (authError) {
            console.error('Setup Auth ID RPC Delete Error:', authError);
            
            // Compensation: Restore the link if Auth delete fails
            await supabase
                .from('employees')
                .update({ auth_id: employee.auth_id })
                .eq('id', id);

            throw new Error(`Authユーザーの削除(RPC)に失敗したため、処理を中断して元に戻しました: ${authError.message}`);
        }
    }

    // 4. Delete DB Record
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteManyEmployeesBySetupAdmin(ids: string[]) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') throw new Error('Unauthorized');

    const supabase = getSupabaseAdmin();

    // 1. Get Auth IDs to process
    const { data: employees } = await supabase.from('employees').select('id, auth_id').in('id', ids);

    const validIdsToDelete: string[] = [];
    const idsToUnlink: string[] = [];
    const empMap = new Map<string, string>(); // id -> auth_id

    if (employees) {
        employees.forEach(e => {
            if (e.auth_id) {
                idsToUnlink.push(e.id);
                empMap.set(e.id, e.auth_id);
            } else {
                validIdsToDelete.push(e.id);
            }
        });
    }

    // 2. Unlink Auth IDs (Bulk)
    if (idsToUnlink.length > 0) {
        const { error: unlinkError } = await supabase
            .from('employees')
            .update({ auth_id: null })
            .in('id', idsToUnlink);
        
        if (unlinkError) {
             throw new Error(`一括削除の準備(Unlink)に失敗しました: ${unlinkError.message}`);
        }
    }

    // 3. Delete Auth Users (Loop with RPC)
    if (idsToUnlink.length > 0) {
        await Promise.all(idsToUnlink.map(async (empId) => {
            const authId = empMap.get(empId);
            if (authId) {
                const { error } = await supabase.rpc('force_delete_auth_user', { target_user_id: authId });
                if (error) {
                    console.error(`Setup Bulk Auth RPC Delete Error for ${empId}:`, error);
                    // Failure: We must re-link this user effectively
                    await supabase.from('employees').update({ auth_id: authId }).eq('id', empId);
                    // Do NOT add to validIdsToDelete
                } else {
                    // Success
                    validIdsToDelete.push(empId);
                }
            }
        }));
    }

    if (validIdsToDelete.length === 0) {
         if (employees && employees.length > 0) {
             throw new Error('Authユーザーの削除にすべて失敗したため、DB削除を中断しました。');
         }
         return; 
    }

    // 4. Delete ONLY successfully processed DB Records
    const { error } = await supabase.from('employees').delete().in('id', validIdsToDelete);
    if (error) throw error;
}
