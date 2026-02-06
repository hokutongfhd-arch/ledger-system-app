'use server';

import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function getLoginEmailAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch Employee Record
    const { data: employee, error } = await supabaseAdmin
        .from('employees')
        .select('email')
        .eq('employee_code', employeeCode)
        .single();

    if (error || !employee) {
        // Return null if not found, allowing client to fallback or fail
        return null;
    }

    return employee.email;
}
