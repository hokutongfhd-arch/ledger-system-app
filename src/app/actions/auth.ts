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
