import { supabase } from '../../lib/supabaseClient';
import type { Log } from '../../lib/types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const logApi = {
    fetchLogsByRange: async (startDate: string, endDate: string) => {
        return await supabase
            .from('logs')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });
    },
    fetchMinLogDate: async () => {
        return await supabase
            .from('logs')
            .select('created_at')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
    },
    insertLog: async (data: any) => {
        return await supabase.from('logs').insert(data).select().single();
    }
};

const TARGET_NAMES: Record<string, string> = {
    tablets: '勤怠タブレット',
    iPhones: 'iPhone',
    iphones: 'iPhone',
    featurePhones: 'ガラホ',
    featurephones: 'ガラホ',
    routers: 'モバイルルーター',
    employees: '社員マスタ',
    areas: 'エリアマスタ',
    addresses: '住所マスタ',
    manuals: 'マニュアル'
};

export const logService = {
    mapLogFromDb: (d: any): Log => ({
        id: s(d.id),
        timestamp: s(d.created_at),
        user: s(d.user),
        target: s(d.target),
        action: (d.action as any) || 'update',
        details: s(d.detail),
    }),

    getLogsByRange: async (startDate: string, endDate: string) => {
        const { data } = await logApi.fetchLogsByRange(startDate, endDate);
        return (data || []).map(logService.mapLogFromDb);
    },

    getMinLogDate: async () => {
        const { data } = await logApi.fetchMinLogDate();
        return data?.created_at || null;
    },

    addLog: async (endpoint: string, action: string, details: string, userName: string) => {
        const newLog = {
            user: userName,
            target: TARGET_NAMES[endpoint] || endpoint,
            action,
            detail: details,
        };
        const { data } = await logApi.insertLog(newLog);
        return data ? logService.mapLogFromDb(data) : null;
    }
};
