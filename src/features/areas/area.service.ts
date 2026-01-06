import { supabase } from '../../lib/supabaseClient';
import type { Area } from './area.types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const areaApi = {
    fetchAreas: async () => {
        return await supabase.from('areas').select('*');
    },
    insertArea: async (data: any) => {
        return await supabase.from('areas').insert(data).select().single();
    },
    updateArea: async (id: string, data: any) => {
        return await supabase.from('areas').update(data).eq('id', id);
    },
    deleteArea: async (id: string) => {
        // DB PK is area_code
        return await supabase.from('areas').delete().eq('area_code', id);
    },
    deleteAreas: async (ids: string[]) => {
        return await supabase.from('areas').delete().in('area_code', ids);
    }
};

export const areaService = {
    mapAreaFromDb: (d: any): Area => ({
        id: d.area_code,
        areaCode: s(d.area_code),
        areaName: s(d.area_name),
    }),

    mapAreaToDb: (t: Partial<Area>) => ({
        area_code: t.areaCode,
        area_name: t.areaName,
    }),

    getAreas: async () => {
        const { data } = await areaApi.fetchAreas();
        return (data || []).map(areaService.mapAreaFromDb);
    },

    saveArea: async (item: Area, isUpdate: boolean = false) => {
        const dbData = areaService.mapAreaToDb(item);
        if (isUpdate) {
            return await areaApi.updateArea(item.id, dbData);
        } else {
            return await areaApi.insertArea(dbData);
        }
    },

    deleteArea: async (id: string) => {
        return await areaApi.deleteArea(id);
    },
    deleteAreas: async (ids: string[]) => {
        return await areaApi.deleteAreas(ids);
    }
};
