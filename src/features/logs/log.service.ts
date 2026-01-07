import { supabase } from '../../lib/supabaseClient';
import type { Log } from '../../lib/types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const logApi = {
    fetchLogs: async (params: {
        page?: number;
        pageSize?: number;
        startDate?: string;
        endDate?: string;
        actor?: string; // name or code
        actionType?: string;
        result?: 'success' | 'failure';
        target?: string;
        sort?: { field: 'occurred_at' | 'actor_name'; order: 'asc' | 'desc' };
    }) => {
        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' });

        // Filters
        if (params.startDate) query = query.gte('occurred_at', params.startDate);
        if (params.endDate) query = query.lte('occurred_at', params.endDate);
        if (params.actionType) query = query.eq('action_type', params.actionType);
        if (params.result) query = query.eq('result', params.result);
        if (params.target) query = query.eq('target_type', params.target);

        if (params.actor) {
            // Check if it looks like an employee code or name
            if (/^[0-9]+$/.test(params.actor)) {
                query = query.like('actor_employee_code', `%${params.actor}%`);
            } else {
                query = query.like('actor_name', `%${params.actor}%`);
            }
        }

        // Sorting
        const sortField = params.sort?.field || 'occurred_at';
        const sortOrder = params.sort?.order === 'asc';
        query = query.order(sortField, { ascending: sortOrder });

        // Pagination
        const page = params.page || 1;
        const pageSize = params.pageSize || 15;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        return await query;
    },

    // Kept for backward compatibility if needed, but ideally replaced
    fetchLogsByRange: async (startDate: string, endDate: string) => {
        return await supabase
            .from('audit_logs')
            .select('*')
            .gte('occurred_at', startDate)
            .lte('occurred_at', endDate)
            .order('occurred_at', { ascending: false });
    },

    fetchMinLogDate: async () => {
        return await supabase
            .from('audit_logs')
            .select('occurred_at')
            .order('occurred_at', { ascending: true })
            .limit(1)
            .single();
    },
    insertLog: async (data: any) => {
        // NOTE: Client side usually shouldn't write directly to audit_logs for security, 
        // but keeping as per existing structure if 'logs' was meant to be 'audit_logs'
        return await supabase.from('audit_logs').insert(data).select().single();
    }
};

export const TARGET_NAMES: Record<string, string> = {
    manual: 'マニュアル',
    admin: '管理コンソール',
    auth: '認証',
    audit_rule: '不正検知ルール',
    manual_list: 'マニュアル一覧',
    dashboard: 'ダッシュボード',
    system: 'システム',
    report: 'レポート',
    unknown: 'その他'
};

const ACTION_NAMES: Record<string, string> = {
    CREATE: '登録',
    UPDATE: '更新',
    DELETE: '削除',
    IMPORT: 'インポート',
    LOGIN_SUCCESS: 'ログイン',
    LOGIN_FAILURE: 'ログイン失敗',
    LOGOUT: 'ログアウト',
    EXPORT: 'エクスポート',
    VIEW_PAGE: 'ページ閲覧',
    ANOMALY_DETECTED: '異常検知',
    GENERATE: 'レポート生成',
    ANOMALY_RESPONSE: '不正対応登録',
    DOWNLOAD_TEMPLATE: 'テンプレート読込',
    ERROR: 'エラー'
};

export const logService = {
    mapLogFromDb: (d: any): Log => {
        const targetRaw = d.target_type;
        const actionRaw = d.action_type;

        // Resolve Display Names
        const target = TARGET_NAMES[targetRaw] || targetRaw;
        const action = ACTION_NAMES[actionRaw] || actionRaw;

        // Generate details text
        let details = d.metadata?.message || '';
        if (!details) {
            const resultStr = d.result === 'success' ? '成功' : '失敗';
            details = `[${action}] ${target} (ID: ${d.target_id || '-'}) - ${resultStr}`;
        }

        return {
            id: s(d.id),
            timestamp: s(d.occurred_at),
            actorName: s(d.actor_name),
            actorEmployeeCode: s(d.actor_employee_code),
            target: target,
            targetRaw: targetRaw,
            targetId: s(d.target_id),
            action: action,
            actionRaw: actionRaw,
            result: (d.result === 'success' || d.result === 'failure') ? d.result : 'failure',
            metadata: d.metadata || {},
            ipAddress: s(d.ip_address),
            details: details,
            user: s(d.actor_name) || s(d.actor_employee_code) || 'System',
            is_acknowledged: d.is_acknowledged,
            acknowledged_by: d.acknowledged_by,
            acknowledged_at: d.acknowledged_at,
            response_status: d.response_status,
            response_note: d.response_note,
            severity: d.severity,
            is_archived: d.is_archived,
            archived_at: d.archived_at,
        };
    },

    fetchLogs: async (params: any) => { // Wrapper for type safety if needed
        const { data, count, error } = await logApi.fetchLogs(params);
        if (error) throw error;
        return {
            logs: (data || []).map(logService.mapLogFromDb),
            total: count || 0
        };
    },

    // Backward compatibility wrappers...
    getLogsByRange: async (startDate: string, endDate: string) => {
        const { data } = await logApi.fetchLogsByRange(startDate, endDate);
        return (data || []).map(logService.mapLogFromDb);
    },

    getMinLogDate: async () => {
        const { data } = await logApi.fetchMinLogDate();
        return data?.occurred_at || null;
    },

    createLog: async (logData: {
        actor_name: string;
        actor_employee_code?: string;
        target_type: string;
        action_type: string;
        details?: string;
        result: 'success' | 'failure';
        metadata?: any;
    }) => {
        try {
            const payload = {
                ...logData,
                metadata: { message: logData.details, ...logData.metadata },
                occurred_at: new Date().toISOString()
            };
            const { data } = await logApi.insertLog(payload);
            return data ? logService.mapLogFromDb(data) : null;
        } catch (error) {
            console.error('[Audit Log Failure] Failed to create log. Proceeding without logging.', error);
            // Return a mock log to satisfy callers expecting a result, or null.
            // Returning null is safer if caller checks for it, but if caller expects a Log object it might crash.
            // Reviewing typical usage: often awaited but return value ignored, or used for updating UI list.
            // If it fails, we simply don't return the new log.
            return null;
        }
    },

    addLog: async (endpoint: string, action: string, details: string, userName: string) => {
        try {
            // NOTE: This legacy addLog is less precise than the new structured logging. 
            // Ideally should assume 'success' and try to map legacy args to new schema if writing to audit_logs.
            // For now, mapping best effort.
            return await logService.createLog({
                actor_name: userName,
                target_type: endpoint,
                action_type: action.toUpperCase(),
                details: details,
                result: 'success'
            });
        } catch (error) {
            console.error('[Audit Log Failure] Failed to add legacy log.', error);
            return null;
        }
    }
};
