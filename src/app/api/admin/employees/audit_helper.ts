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
