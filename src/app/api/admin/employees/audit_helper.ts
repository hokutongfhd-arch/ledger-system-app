import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Manually update the audit_logs entry created by database trigger to assign the correct actor.
 * Used when performing operations as Service Role (System) on behalf of a user.
 */
export async function fixAuditLogActor(
    supabaseAdmin: SupabaseClient,
    targetId: string,
    targetType: string, // e.g., 'employee'
    actorUser: any, // Supabase User object
    actionType?: string // 'INSERT', 'UPDATE', 'DELETE' (optional filter)
) {
    if (!actorUser || !targetId) return;

    const actorName = actorUser.user_metadata?.name || actorUser.email || 'Unknown User';
    const actorEmail = actorUser.email;
    const actorEmployeeCode = actorUser.user_metadata?.employee_code;

    // Retry a few times as trigger might be slighty async or clock skew
    // But usually trigger runs in same transaction commit, so it should be visible immediately
    // unless read replica lag (unlikely for single instance).

    // We update the MOST RECENT log entry for this target that has no actor (or system actor)
    // and was created very recently.
    try {
        // 1. Find the log entry
        const { data: logs, error: searchError } = await supabaseAdmin
            .from('audit_logs')
            .select('id')
            .eq('target_id', targetId)
            //.eq('target_type', targetType) // Trigger might use different casing? 'Employee' vs 'employee'?
            // Let's assume user provided correct one or we search loosely if needed.
            // But 'target_type' is safer to include if we know it.
            .is('actor_auth_id', null) // Typically trigger leaves it null or sets to specific system ID?
            // If trigger uses 'auth.uid()', it might be set to the Service Role User ID if we use Service Role?
            // Service Role ID usually is not null. It's a specific UUID.
            // Let's NOT filter by actor_auth_id null, but filter by "created recently".
            .order('created_at', { ascending: false })
            .limit(1);

        if (searchError || !logs || logs.length === 0) {
            console.warn(`[AuditFix] Log not found for ${targetType}:${targetId}`);
            return;
        }

        const logId = logs[0].id;

        // 2. Update it
        const { error: updateError } = await supabaseAdmin
            .from('audit_logs')
            .update({
                actor_auth_id: actorUser.id,
                actor_name: actorName,
                actor_employee_code: actorEmployeeCode
            })
            .eq('id', logId);

        if (updateError) {
            console.error(`[AuditFix] Failed to update log ${logId}: ${updateError.message}`);
        } else {
            console.log(`[AuditFix] Patched log ${logId} with actor ${actorName}`);
        }

    } catch (err) {
        console.error('[AuditFix] Unexpected error:', err);
    }
}

/**
 * Manually patches the `logs` table to correct the actor information for operations
 * performed by the Service Role (which default to System/Service Role actor).
 * 
 * @param supabaseAdmin - The Service Role client
 * @param targetId - The ID of the record that was affected (e.g., employee.id)
 * @param tableName - The name of the table allowed in logs (e.g., 'employees')
 * @param user - The authenticated user object (from session)
 * @param operation - 'INSERT' | 'UPDATE' | 'DELETE'
 */
export async function fixOperationLogActor(
    supabaseAdmin: SupabaseClient,
    targetId: string,
    tableName: string,
    user: any,
    operation: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT'
) {
    if (!user) return;

    // 1. Resolve User Info
    const actorName =
        user.user_metadata?.name ||
        user.user_metadata?.name_kana ||
        user.email ||
        'Unknown User';

    const actorCode =
        user.user_metadata?.employee_code ||
        user.user_metadata?.code ||
        '';

    // 2. Find the Log Entry
    // The logs trigger runs AFTER the operation.
    // We look for a log entry created very recently matches the operation and target.
    // "logs" table typically has: table_name, operation, created_at, etc.
    // It heavily relies on JSONB columns: old_data, new_data.

    const timeWindow = new Date(Date.now() - 5000).toISOString(); // Look back 5 seconds

    let query = supabaseAdmin
        .from('logs')
        .select('id')
        .eq('table_name', tableName)
        .eq('operation', operation)
        .gt('created_at', timeWindow)
        .order('created_at', { ascending: false })
        .limit(1);

    // Filter by Target ID in JSON Data
    // Note: older Supabase versions might use arrow operators differently.
    // .contains() is strictly for JSONB @> operator.
    if (operation === 'DELETE') {
        // For DELETE, ID is in old_data
        query = query.contains('old_data', { id: targetId });
    } else {
        // For INSERT/UPDATE, ID is in new_data
        query = query.contains('new_data', { id: targetId });
    }

    const { data: logs, error: findError } = await query;

    if (findError) {
        console.warn(`[AuditHelper] Failed to find operation log for patching: ${findError.message}`);
        return;
    }

    if (!logs || logs.length === 0) {
        console.warn(`[AuditHelper] No operation log found to patch for ${tableName}:${operation}:${targetId}`);
        return;
    }

    const logId = logs[0].id;

    // 3. Update the Log Entry
    const { error: updateError } = await supabaseAdmin
        .from('logs')
        .update({
            actor_name: actorName,
            actor_code: actorCode,
        })
        .eq('id', logId);

    if (updateError) {
        console.error(`[AuditHelper] Failed to patch operation log ${logId}: ${updateError.message}`);
    } else {
        console.log(`[AuditHelper] Successfully patched operation log ${logId} -> Actor: ${actorName}`);
    }
}
