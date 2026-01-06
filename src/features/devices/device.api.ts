import { supabase } from '../../lib/supabaseClient';

export const deviceApi = {
    fetchTablets: async () => {
        return await supabase.from('tablets').select('*');
    },
    fetchIPhones: async () => {
        return await supabase.from('iphones').select('*');
    },
    fetchFeaturePhones: async () => {
        return await supabase.from('featurephones').select('*');
    },
    fetchRouters: async () => {
        return await supabase.from('routers').select('*');
    },

    insertDevice: async (table: string, data: any) => {
        return await supabase.from(table).insert(data).select().single();
    },
    updateDevice: async (table: string, id: string, data: any) => {
        return await supabase.from(table).update(data).eq('id', id);
    },
    deleteDevice: async (table: string, id: string) => {
        return await supabase.from(table).delete().eq('id', id);
    },
    deleteDevices: async (table: string, ids: string[]) => {
        return await supabase.from(table).delete().in('id', ids);
    }
};
