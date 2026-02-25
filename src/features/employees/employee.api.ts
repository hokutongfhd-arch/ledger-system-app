import { supabase } from '../../lib/supabaseClient';

export const employeeApi = {
    fetchEmployees: async () => {
        return await supabase.from('employees').select('id, employee_code, name, name_kana, gender, birthday, join_date, age_at_month_end, years_in_service, months_in_service, area_code, address_code, authority, auth_id, email, version, updated_at');
    },
    insertEmployee: async (data: any) => {
        return await supabase.from('employees').insert(data).select().single();
    },
    updateEmployee: async (id: string, version: number, data: any) => {
        return await supabase.from('employees').update({ ...data, version: data.version + 1 }).eq('id', id).eq('version', version);
    },
    updateEmployeeSafe: async (id: string, version: number, data: any) => {
        return await supabase.rpc('update_employee_safe', {
            p_id: id,
            p_version: version,
            p_employee_code: data.employee_code,
            p_name: data.name,
            p_name_kana: data.name_kana,
            p_email: data.email,
            p_gender: data.gender,
            p_birthday: data.birthday,
            p_join_date: data.join_date,
            p_area_code: data.area_code,
            p_address_code: data.address_code,
            p_authority: data.authority
        });
    },
    deleteEmployee: async (id: string, version: number) => {
        return await supabase.from('employees').delete().eq('id', id).eq('version', version);
    },
    deleteEmployees: async (ids: string[]) => {
        return await supabase.from('employees').delete().in('id', ids);
    }
};
