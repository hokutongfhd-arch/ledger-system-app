import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Admin Client
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Supabase URL or Service Role Key is missing');
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

export async function GET(req: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const url = new URL(req.url);
        const dryRun = url.searchParams.get('dryRun') !== 'false'; // Default to true for safety

        // 1. Fetch all Auth Users
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (authError) throw authError;

        // 2. Fetch all Employees (auth_id)
        const { data: employees, error: dbError } = await supabaseAdmin
            .from('employees')
            .select('auth_id')
            .not('auth_id', 'is', null);

        if (dbError) throw dbError;

        // Map employee auth_ids for fast lookup
        const employeeAuthIds = new Set(employees.map(e => e.auth_id));

        // 3. Find Orphans
        const orphans = users.filter(u => !employeeAuthIds.has(u.id));

        // Filter out strict keep list if necessary (e.g. specific admin IDs)
        // For now, we assume ANY valid user must be in employees table.

        const results = {
            totalAuthUsers: users.length,
            totalEmployeesWithAuth: employees.length,
            orphansFound: orphans.length,
            orphans: orphans.map(u => ({ id: u.id, email: u.email })),
            deleted: [] as string[],
            errors: [] as any[],
            mode: dryRun ? 'Dry Run (No changes)' : 'Live Execution'
        };

        if (!dryRun && orphans.length > 0) {
            console.log(`Starting cleanup of ${orphans.length} orphans...`);

            for (const orphan of orphans) {
                // Pre-cleanup: Remove dependencies in other tables

                // Helper to capture errors during cleanup
                const safeUpdate = async (table: string, update: any, col: string) => {
                    const { error } = await supabaseAdmin.from(table).update(update).eq(col, orphan.id);
                    if (error) {
                        const msg = `Failed to cleanup ${table} for ${orphan.email}: ${error.message}`;
                        console.warn(msg);
                        results.errors.push({ id: orphan.id, email: orphan.email, error: msg, phase: 'pre-cleanup' });
                    }
                };

                // Clear audit logs links (acknowledged_by)
                await safeUpdate('audit_logs', { acknowledged_by: null }, 'acknowledged_by');

                // Just in case, try to nullify employees auth_id if it exists
                await safeUpdate('employees', { auth_id: null }, 'auth_id');

                // Delete the user
                const { error } = await supabaseAdmin.auth.admin.deleteUser(orphan.id);
                if (error) {
                    console.error(`Failed to delete ${orphan.email}:`, error);
                    results.errors.push({
                        id: orphan.id,
                        email: orphan.email,
                        error: error.message,
                        details: (error as any).details,
                        hint: (error as any).hint,
                        code: (error as any).code
                    });
                } else {
                    console.log(`Deleted orphan: ${orphan.email}`);
                    results.deleted.push(orphan.email || orphan.id);
                }
            }
        }

        return NextResponse.json(results);

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
