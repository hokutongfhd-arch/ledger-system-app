import { supabase } from '../../lib/supabaseClient';

export const employeeApi = {
    fetchEmployees: async () => {
        return await supabase.from('employees').select('id, employee_code, name, name_kana, gender, birthday, join_date, age_at_month_end, years_in_service, months_in_service, area_code, address_code, authority, auth_id');
    },
    insertEmployee: async (data: any) => {
        return await supabase.from('employees').insert(data).select().single();
    },
    updateEmployee: async (id: string, data: any) => {
        return await supabase.from('employees').update(data).eq('id', id);
    },
    deleteEmployee: async (id: string) => {
        return await supabase.from('employees').delete().eq('id', id);
    },
    deleteEmployees: async (ids: string[]) => {
        return await supabase.from('employees').delete().in('id', ids);
    }
};
