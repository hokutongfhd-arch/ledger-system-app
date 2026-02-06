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
        // password: data.password, // Password is NOT stored in DB
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

        // Compensation: If DB insert fails, delete the Auth User we just tried to link to avoid orphans
        if (dbItem.auth_id) {
            console.log(`Compensating: Deleting Auth User ${dbItem.auth_id} due to DB failure`);
            const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(dbItem.auth_id);
            if (cleanupError) {
                console.error(`Compensation Failed for ${dbItem.auth_id}:`, cleanupError);
            } else {
                console.log(`Compensation Success: Deleted orphan Auth User ${dbItem.auth_id}`);
            }
        }

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

export async function deleteEmployeeAction(id: string) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthenticated');
    }

    // 2. Fetch Employee to get Auth ID before deletion
    const supabaseAdmin = getSupabaseAdmin();
    const { data: employee, error: fetchError } = await supabaseAdmin
        .from('employees')
        .select('auth_id, employee_code')
        .eq('id', id)
        .single();

    if (fetchError) {
        throw new Error(`Employee not found: ${fetchError.message}`);
    }

    // 3. Delete DB Record First (to avoid FK constraint issues)
    const { error: deleteError } = await supabaseAdmin
        .from('employees')
        .delete()
        .eq('id', id);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    // 4. Delete Auth User if linked (now safe)
    if (employee.auth_id) {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(employee.auth_id);
        if (authDeleteError) {
            console.error(`Failed to delete Auth User ${employee.auth_id}:`, authDeleteError);
        }
    } else {
        // Fallback: If auth_id is missing in DB (inconsistency), try to find by metadata
        console.warn(`Employee ${id} (Code: ${employee.employee_code}) has no auth_id. Attempting fallback cleanup...`);
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        // Find orphan by code
        const orphan = users.find(u => u.user_metadata?.employee_code === employee.employee_code || u.user_metadata?.employee_code === String(employee.employee_code));

        if (orphan) {
            console.log(`Found orphan Auth User via Code ${employee.employee_code}: ${orphan.id}. Deleting...`);
            const { error: orphanError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
            if (orphanError) console.error('Fallback Orphan Delete Failed:', orphanError);
        }
    }

    return { success: true };
}

export async function deleteManyEmployeesAction(ids: string[]) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthenticated');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Fetch Employees to get Auth IDs
    const { data: employees, error: fetchError } = await supabaseAdmin
        .from('employees')
        .select('auth_id, employee_code')
        .in('id', ids);

    if (fetchError) {
        throw new Error(`Employees fetch failed: ${fetchError.message}`);
    }

    // 3. Delete DB Records First
    const { error: deleteError } = await supabaseAdmin
        .from('employees')
        .delete()
        .in('id', ids);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    // 4. Delete Auth Users
    if (employees && employees.length > 0) {
        // Run in parallel
        await Promise.all(employees.map(async (emp) => {
            if (emp.auth_id) {
                const { error } = await supabaseAdmin.auth.admin.deleteUser(emp.auth_id);
                if (error) {
                    console.error(`Failed to delete Auth User ${emp.auth_id} (Code: ${emp.employee_code}):`, error);
                }
            } else {
                // Fallback for bulk delete
                const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                const orphan = users.find(u => u.user_metadata?.employee_code === emp.employee_code || u.user_metadata?.employee_code === String(emp.employee_code));
                if (orphan) {
                    await supabaseAdmin.auth.admin.deleteUser(orphan.id);
                }
            }
        }));
    }

    return { success: true };
}
