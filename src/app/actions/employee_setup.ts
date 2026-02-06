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
    };

    const { error } = await supabase.from('employees').update(dbItem).eq('id', item.id);
    if (error) throw error;
}

export async function deleteEmployeeBySetupAdmin(id: string) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') throw new Error('Unauthorized');

    const supabase = getSupabaseAdmin();

    // 1. Get Auth ID
    const { data: employee } = await supabase.from('employees').select('auth_id').eq('id', id).single();

    // 2. Delete Auth User
    if (employee?.auth_id) {
        await supabase.auth.admin.deleteUser(employee.auth_id).catch(e => console.error('Setup Auth Delete Error:', e));
    }

    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
}

export async function deleteManyEmployeesBySetupAdmin(ids: string[]) {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value !== 'true') throw new Error('Unauthorized');

    const supabase = getSupabaseAdmin();

    // 1. Get Auth IDs
    const { data: employees } = await supabase.from('employees').select('auth_id').in('id', ids);

    // 2. Delete Auth Users
    if (employees && employees.length > 0) {
        // Run in parallel
        await Promise.all(employees.map(async (emp) => {
            if (emp.auth_id) {
                await supabase.auth.admin.deleteUser(emp.auth_id).catch(e => console.error('Setup Bulk Auth Delete Error:', e));
            }
        }));
    }

    const { error } = await supabase.from('employees').delete().in('id', ids);
    if (error) throw error;
}
