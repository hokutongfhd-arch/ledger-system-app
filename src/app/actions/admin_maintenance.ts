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
export async function deleteOrphanedAuthUserAction(identifier: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const results = {
        deletedCount: 0,
        errors: [] as string[]
    };

    try {
        const users = await getAllAuthUsers(supabaseAdmin);

        // Find users matching code (metadata) or email (direct)
        const trimmedIdentifier = identifier.trim().toLowerCase();

        console.log(`Searching for orphans to delete with identifier: '${trimmedIdentifier}'`);

        const targetUsers = users.filter(u => {
            const metaCode = u.user_metadata?.employee_code;
            const matchesCode = metaCode === identifier.trim() || metaCode === String(identifier.trim());

            const userEmail = u.email || '';
            const normalizedUserEmail = userEmail.toLowerCase().trim();
            const normalizedInput = trimmedIdentifier; // already trimmed and lowered above
            const matchesEmail = normalizedUserEmail === normalizedInput;

            if (matchesCode || matchesEmail) {
                console.log(`[DELETE TARGET FOUND] ID: ${u.id}, Email: ${u.email}, Code: ${metaCode}`);
            }

            return matchesCode || matchesEmail;
        });

        console.log(`Found ${targetUsers.length} orphaned candidates for identifier ${identifier}`);

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

const getAllAuthUsers = async (supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) => {
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    console.log('Starting getAllAuthUsers fetch...');
    while (true) {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
            page: page,
            perPage: perPage
        });

        if (error) {
            console.error('listUsers error:', error);
            throw error;
        }

        if (!users || users.length === 0) {
            break;
        }

        console.log(`Fetched page ${page}: ${users.length} users`);
        allUsers = allUsers.concat(users);

        if (users.length < perPage) {
            break;
        }

        page++;
    }

    console.log(`Total users fetched: ${allUsers.length}`);
    return allUsers;
};

/**
 * Diagnostic tool to check if an employee exists in DB or Auth
 */
export async function diagnoseEmployeeStateAction(identifier: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const results = {
        inDatabase: null as any,
        inAuth: [] as any[],
        message: ''
    };

    try {
        // 1. Check DB (Try matching code)
        const { data: dbEmp, error: dbError } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('employee_code', identifier)
            .maybeSingle();

        results.inDatabase = dbEmp;

        // 2. Check Auth
        try {
            const users = await getAllAuthUsers(supabaseAdmin);
            const trimmedIdentifier = identifier.trim().toLowerCase();
            console.log(`Diagnosing for identifier: '${trimmedIdentifier}'`);

            results.inAuth = users.filter(u => {
                const metaCode = u.user_metadata?.employee_code;
                const matchesCode = metaCode && (metaCode === trimmedIdentifier || String(metaCode) === trimmedIdentifier);

                const userEmail = u.email || '';
                const normalizedUserEmail = userEmail.toLowerCase().trim();
                const normalizedInput = trimmedIdentifier.trim();
                const matchesEmail = normalizedUserEmail === normalizedInput;

                if (matchesEmail || matchesCode) {
                    console.log(`✅ Match found! ID: ${u.id}, Email: ${u.email}, Code: ${metaCode}`);
                }

                return matchesCode || matchesEmail || (dbEmp && dbEmp.email && u.email?.toLowerCase() === dbEmp.email.toLowerCase());
            }).map(u => ({ id: u.id, email: u.email, metadata: u.user_metadata }));

            console.log(`Found ${results.inAuth.length} matches in Auth.`);

        } catch (authError) {
            console.error('Auth check failed:', authError);
            // Non-fatal, just empty
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
