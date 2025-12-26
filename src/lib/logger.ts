import { supabase as staticSupabase } from './supabaseClient';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export type LogActionType =
    | 'LOGIN_SUCCESS'     // 監査ログ
    | 'LOGIN_FAILURE'     // 監査ログ
    | 'LOGOUT'            // 監査ログ
    | 'CREATE'            // 原則、操作ログ。Authユーザー作成等は監査ログ
    | 'UPDATE'            // 原則、操作ログ
    | 'DELETE'            // 原則、操作ログ
    | 'IMPORT'            // 操作ログ
    | 'EXPORT'            // 監査ログ (データ持ち出しの証跡)
    | 'GENERATE'          // 監査ログ (レポート生成)
    | 'ERROR'             // システム/監査ログ
    | 'ANOMALY_DETECTED'; // 監査ログ (自動検知)

export type TargetType =
    | 'auth'
    | 'employee'
    | 'iphone'
    | 'feature_phone'
    | 'tablet'
    | 'router'
    | 'area'
    | 'address'
    | 'report'
    | 'unknown';

export interface LogEntry {
    action: LogActionType;
    targetType: TargetType;
    targetId?: string;
    result: 'success' | 'failure';
    message?: string;
    metadata?: any;
    actor?: {
        authId?: string;
        employeeCode?: string;
        name?: string;
    };
    isAcknowledged?: boolean;
}

class LoggerService {
    private client: any = null;

    private getClient() {
        if (typeof window === 'undefined') return staticSupabase;
        if (this.client) return this.client;

        this.client = createClientComponentClient();
        return this.client;
    }

    /**
     * Writes a log entry to the audit_logs table.
     * This method is "fire and forget" mostly, but handles errors internally to not break the app.
     */
    async log(entry: LogEntry) {
        try {
            const supabase = this.getClient();

            // 1. Resolve Actor
            let actorAuthId = entry.actor?.authId;
            let actorEmployeeCode = entry.actor?.employeeCode;
            let actorName = entry.actor?.name;

            if (!actorAuthId) {
                // Only try to fetch session if definitely in the browser and not a login/auth related action 
                if (typeof window !== 'undefined' && entry.targetType !== 'auth') {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        actorAuthId = session.user.id;
                    }
                }
            }

            // 2. Prepare Payload
            const payload = {
                actor_auth_id: actorAuthId,
                actor_employee_code: actorEmployeeCode,
                actor_name: actorName,
                action_type: entry.action,
                target_type: entry.targetType,
                target_id: entry.targetId,
                result: entry.result,
                is_acknowledged: entry.isAcknowledged ?? false,
                metadata: {
                    message: entry.message,
                    ...entry.metadata
                },
                ip_address: null, // Client-side IP fetching is hard without a server endpoint, usually handled by RLS/Trigger or Edge Function.
            };

            // 3. Insert
            const { error } = await supabase.from('audit_logs').insert(payload);

            if (error) {
                console.warn('Logger: Failed to write to audit_logs', error);
            }

        } catch (err) {
            console.warn('Logger: Unexpected error', err);
        }
    }

    async info(entry: Omit<LogEntry, 'result'>) {
        return this.log({ ...entry, result: 'success' });
    }

    async error(entry: Omit<LogEntry, 'result'>, errorDetails?: any) {
        return this.log({
            ...entry,
            result: 'failure',
            metadata: { ...entry.metadata, error: errorDetails }
        });
    }
}

export const logger = new LoggerService();
