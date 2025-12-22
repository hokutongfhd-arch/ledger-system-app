import { supabase } from './supabaseClient';

export type LogActionType =
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILURE'
    | 'LOGOUT'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'IMPORT'
    | 'EXPORT'
    | 'ERROR';

export type TargetType =
    | 'auth'
    | 'employee'
    | 'iphone'
    | 'feature_phone'
    | 'tablet'
    | 'router'
    | 'area'
    | 'address'
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
    }
}

class LoggerService {
    /**
     * Writes a log entry to the audit_logs table.
     * This method is "fire and forget" mostly, but handles errors internally to not break the app.
     */
    async log(entry: LogEntry) {
        try {
            // 1. Resolve Actor (if not provided, try to get from current session)
            let actorAuthId = entry.actor?.authId;
            let actorEmployeeCode = entry.actor?.employeeCode;
            let actorName = entry.actor?.name;

            if (!actorAuthId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    actorAuthId = session.user.id;
                    // We might not have employee code/name readily available without fetching, 
                    // but usually the caller (Context) has it. 
                    // If missing, we leave it null or assume the backend context knows.
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
