'use server';

import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { LogEntry } from '@/lib/logger';

/**
 * クライアントサイドからの RLS エラーを回避するためのサーバーアクション
 */
export async function createLogAction(entry: LogEntry) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerActionClient({ cookies: () => cookieStore as any });

        // 1. 実行者の特定
        let actorAuthId = entry.actor?.authId;
        let actorEmployeeCode = entry.actor?.employeeCode;
        let actorName = entry.actor?.name;

        if (!actorAuthId) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) actorAuthId = session.user.id;
        }

        if (actorAuthId && (!actorName || !actorEmployeeCode)) {
            const { data: profile } = await supabase
                .from('employees')
                .select('name, employee_code')
                .eq('auth_id', actorAuthId)
                .single();

            if (profile) {
                actorName = actorName || profile.name;
                actorEmployeeCode = actorEmployeeCode || profile.employee_code;
            }
        }

        // 2. ペイロードの準備
        const payload = {
            actor_auth_id: actorAuthId,
            actor_employee_code: actorEmployeeCode,
            actor_name: actorName,
            action_type: entry.action,
            target_type: entry.targetType,
            target_id: entry.targetId,
            result: entry.result,
            is_acknowledged: entry.isAcknowledged ?? false,
            severity: entry.severity || 'low',
            details: entry.message || '',
            occurred_at: new Date().toISOString(),
            metadata: {
                message: entry.message,
                ...entry.metadata
            },
            ip_address: null,
        };

        // 3. 挿入 (Service Role を使用して RLS を回避)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const { error } = await supabaseAdmin.from('audit_logs').insert(payload);

        if (error) {
            console.error('createLogAction Error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };

    } catch (err) {
        console.error('createLogAction Unexpected Error:', err);
        return { success: false, error: String(err) };
    }
}
