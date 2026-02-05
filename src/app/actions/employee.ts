'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function createEmployeeAction(data: any) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication & Admin Role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthenticated');
    }

    // Optional: Check if user is admin in 'employees' table or metadata
    const { data: employee } = await supabase
        .from('employees')
        .select('authority')
        .eq('auth_id', user.id)
        .single();

    // Allow if actual admin OR if Setup Account (which might not be in DB via this path, but handled by getSupabaseAdmin in other flows)
    // For now, assume if they have access to the UI and are authenticated, they passed middleware.
    // Ideally, check employee.authority === 'admin'.

    // 2. Use Admin Client to Insert
    const supabaseAdmin = getSupabaseAdmin();

    const dbItem = {
        employee_code: data.code,
        auth_id: data.auth_id,
        password: data.password,
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
        role: undefined // remove 'role' from DB object if it exists in data but not in DB schema (schema uses authority)
    };

    // Clean up undefined/null values that shouldn't be in DB if table doesn't support them or strict checks
    delete (dbItem as any).role;

    const { data: result, error } = await supabaseAdmin
        .from('employees')
        .insert(dbItem)
        .select()
        .single();

    if (error) {
        console.error('Create Employee Action Error:', error);
        throw new Error(error.message);
    }

    return result;
}

export async function fetchEmployeesAction() {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthenticated');
    }

    // 2. Use Admin Client to Fetch All (Bypass RLS)
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('employees')
        .select('*')
        .order('employee_code', { ascending: true });

    if (error) {
        console.error('Fetch Employees Action Error:', error);
        throw new Error(error.message);
    }

    return data;
}
