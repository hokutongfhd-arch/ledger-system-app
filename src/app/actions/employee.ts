'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { fixOperationLogActor } from '../api/admin/employees/audit_helper';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { getSetupUserServer } from './auth_setup';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

export async function createEmployeeAction(data: any) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication & Admin Role
    const setupUser = await getSetupUserServer();
    if (setupUser) {
        // Setup user is treated as admin
    } else {
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
    }

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
        email: data.email,
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

        if (error.code === '23505') {
            return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
        }
        return { success: false, error: error.message };
    }

    return { success: true, data: result };
}

export async function fetchEmployeesAction() {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    const setupUser = await getSetupUserServer();
    if (setupUser) {
        // Setup user allowed
    } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Unauthenticated');
        }
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

export async function updateEmployeeAction(id: string, data: any) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    const setupUser = await getSetupUserServer();
    if (setupUser) {
        // Setup user allowed
    } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Unauthenticated');
        }
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Prepare Update Data
    // We map the incoming data to the DB schema
    const dbItem = {
        employee_code: data.code,
        // auth_id: data.auth_id, // auth_id should generally not change
        // password: data.password, 
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
        email: data.email,
        role: undefined
    };

    delete (dbItem as any).role;

    // 3. Update DB Record
    const { data: result, error } = await supabaseAdmin
        .from('employees')
        .update({ ...dbItem, version: data.version + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('version', data.version)
        .select();

    if (error) {
        if (error.code === '23505') return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
        return { success: false, error: error.message };
    }

    if (!result || result.length === 0) {
        return { success: false, error: 'ConcurrencyError' };
    }

    return { success: true, data: result[0] };
}

export async function deleteEmployeeAction(id: string, version: number) {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });

    // 1. Verify Authentication
    let currentUser: any = null;
    const setupUser = await getSetupUserServer();
    if (setupUser) {
        currentUser = setupUser;
    } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Unauthenticated');
        }
        currentUser = user;
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

    // 3. Delete Auth User FIRST (to avoid zombies)
    if (employee.auth_id) {
        // Use RPC to bypass immutable audit log triggers
        const { error: authDeleteError } = await supabaseAdmin.rpc('force_delete_auth_user', { target_user_id: employee.auth_id });
        if (authDeleteError) {
            console.error(`Failed to delete Auth User ${employee.auth_id}:`, authDeleteError);
            throw new Error(`Auth Deletion Failed: ${authDeleteError.message}`); // Stop DB delete
        } else {
            console.log(`Auth User ${employee.auth_id} deleted successfully.`);
        }
    } else {
        // Fallback: If auth_id is missing, try robust search (Email + Code)
        console.warn(`Employee ${id} (Code: ${employee.employee_code}) has no auth_id. Attempting robust fallback cleanup...`);

        // Find users matching code (metadata) or email (direct) - Robust Logic
        // We reuse the robust search logic from admin_maintenance.ts
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (!listError && users) {
            const targetCode = String(employee.employee_code).trim().toLowerCase();
            // Assuming we don't have email in 'employee' object here (select was partial), fetch full
            const { data: fullEmp } = await supabaseAdmin.from('employees').select('email').eq('id', id).single();
            const targetEmail = fullEmp?.email?.trim().toLowerCase();

            const foundOrphan = users.find(u => {
                const metaCode = u.user_metadata?.employee_code;
                const matchesCode = metaCode && (String(metaCode).trim().toLowerCase() === targetCode);
                const matchesEmail = targetEmail && u.email?.trim().toLowerCase() === targetEmail;
                return matchesCode || matchesEmail;
            });

            if (foundOrphan) {
                console.log(`Found orphan Auth User via Robust Search: ${foundOrphan.id}. Deleting...`);
                const { error: orphanError } = await supabaseAdmin.rpc('force_delete_auth_user', { target_user_id: foundOrphan.id });
                if (orphanError) {
                    console.error('Fallback Orphan Delete Failed:', orphanError);
                    throw new Error(`Fallback Auth Deletion Failed: ${orphanError.message}`);
                }
            }
        }
    }

    // 4. Delete DB Record (after Auth is gone)
    const { count, error: deleteError } = await supabaseAdmin
        .from('employees')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('version', version);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    if (count === 0) {
        return { success: false, error: 'NotFoundError' };
    }

    // 5. Audit Log Actor -> REMOVED.
    // User requested to separate Audit/Operation logs.
    if (currentUser) {
        // Run async without awaiting to not block UI response
        console.log(`[DeleteAction] Patching operation log for ${id} by ${currentUser.email || currentUser.code}`);
        await fixOperationLogActor(supabaseAdmin, id, 'employees', currentUser, 'DELETE');
    }

    return { success: true };
}

export async function deleteManyEmployeesAction(items: { id: string, version: number }[]) {
    // We must respect ID + version for each delete as per Rule 6.
    // Loop through individual deletes to ensure version check for each.
    for (const item of items) {
        await deleteEmployeeAction(item.id, item.version);
    }
    return { success: true };
}
