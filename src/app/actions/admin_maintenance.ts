'use server';

import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

/**
 * Clean up an orphaned Auth User by Employee Code or Email.
 * This is used when the DB record is already gone but the Auth User remains.
 */
export async function deleteOrphanedAuthUserAction(employeeCode: string, email?: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const results = {
        deletedCount: 0,
        errors: [] as string[]
    };

    try {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;

        // Find users matching code (metadata) or email
        const targetUsers = users.filter(u => {
            const metaCode = u.user_metadata?.employee_code;
            const matchesCode = metaCode === employeeCode || metaCode === String(employeeCode);
            const matchesEmail = email && u.email?.toLowerCase() === email.toLowerCase();
            return matchesCode || matchesEmail;
        });

        console.log(`Found ${targetUsers.length} orphaned candidates for code ${employeeCode} / email ${email}`);

        for (const user of targetUsers) {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
            if (deleteError) {
                console.error(`Failed to delete orphaned user ${user.id}:`, deleteError);
                results.errors.push(`ID ${user.id}: ${deleteError.message}`);
            } else {
                console.log(`Deleted orphaned user ${user.id}`);
                results.deletedCount++;
            }
        }

        return { success: true, ...results };

    } catch (error: any) {
        console.error('Orphan cleanup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Diagnostic tool to check if an employee exists in DB or Auth
 */
export async function diagnoseEmployeeStateAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const results = {
        inDatabase: null as any,
        inAuth: [] as any[],
        message: ''
    };

    try {
        // 1. Check DB
        const { data: dbEmp, error: dbError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('employee_code', employeeCode)
            .maybeSingle();

        results.inDatabase = dbEmp;

        // 2. Check Auth
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (!authError) {
            results.inAuth = users.filter(u =>
                u.user_metadata?.employee_code === employeeCode ||
                u.user_metadata?.employee_code === String(employeeCode) ||
                (dbEmp && dbEmp.email && u.email === dbEmp.email)
            ).map(u => ({ id: u.id, email: u.email, metadata: u.user_metadata }));
        }

        results.message = `DB: ${dbEmp ? 'FOUND' : 'NOT FOUND'}, Auth: ${results.inAuth.length} users found`;
        return { success: true, data: results };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Force delete DB record by code (Emergency Cleanup)
 */
export async function forceDeleteEmployeeByCodeAction(employeeCode: string) {
    const supabaseAdmin = getSupabaseAdmin();
    try {
        const { error } = await supabaseAdmin
            .from('employees')
            .delete()
            .eq('employee_code', employeeCode);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
