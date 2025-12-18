import { supabase } from '../../lib/supabaseClient';

export const manualApi = {
    fetchManuals: async () => {
        return await supabase.from('device_manuals').select('*').order('created_at', { ascending: false });
    },
    insertManual: async (data: any) => {
        return await supabase.from('device_manuals').insert(data).select().single();
    },
    updateManual: async (id: string, data: any) => {
        return await supabase.from('device_manuals').update(data).eq('id', id);
    },
    deleteManual: async (id: string) => {
        return await supabase.from('device_manuals').delete().eq('id', id);
    },

    // Storage
    uploadFile: async (path: string, file: File) => {
        return await supabase.storage.from('manuals').upload(path, file);
    },
    getPublicUrl: (path: string) => {
        return supabase.storage.from('manuals').getPublicUrl(path);
    },
    deleteFile: async (path: string) => {
        return await supabase.storage.from('manuals').remove([path]);
    }
};

export const manualService = {
    getManuals: async () => {
        const { data } = await manualApi.fetchManuals();
        return (data || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            files: d.files || [],
            updatedAt: d.updated_at || d.created_at
        }));
    },

    saveManual: async (item: any, isUpdate: boolean = false) => {
        const dbData = {
            title: item.title,
            files: item.files,
        };
        if (isUpdate) {
            return await manualApi.updateManual(item.id, dbData);
        } else {
            return await manualApi.insertManual(dbData);
        }
    },

    deleteManual: async (id: string) => {
        return await manualApi.deleteManual(id);
    }
};
