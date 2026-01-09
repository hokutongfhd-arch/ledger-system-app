import { employeeApi } from './employee.api';
import type { Employee } from './employee.types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const employeeService = {
    mapEmployeeFromDb: (d: any): Employee => ({
        id: d.id,
        code: s(d.employee_code),
        name: s(d.name),
        nameKana: s(d.name_kana),
        companyNo: '',
        departmentCode: '',
        email: '',
        password: s(d.password),
        gender: s(d.gender),
        birthDate: s(d.birthday),
        joinDate: s(d.join_date),
        age: Number(d.age_at_month_end) || 0,
        yearsOfService: Number(d.years_in_service) || 0,
        monthsHasuu: Number(d.months_in_service) || 0,
        employeeType: s(d.employee_class),
        salaryType: s(d.salary_class),
        costType: s(d.cost_class),
        areaCode: s(d.area_code),
        addressCode: s(d.address_code),
        roleTitle: s(d.position),
        jobType: s(d.job_type),
        role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        profileImage: typeof window !== 'undefined' ? (localStorage.getItem(`profile_image_${d.id}`) || '') : '',
    }),

    mapEmployeeToDb: (t: Partial<Employee>) => ({
        employee_code: t.code,
        password: t.password,
        name: t.name,
        name_kana: t.nameKana,
        gender: t.gender,
        birthday: t.birthDate,
        join_date: t.joinDate,
        age_at_month_end: String(t.age),
        years_in_service: String(t.yearsOfService),
        months_in_service: String(t.monthsHasuu),
        employee_class: t.employeeType,
        salary_class: t.salaryType,
        cost_class: t.costType,
        area_code: t.areaCode,
        address_code: t.addressCode,
        position: t.roleTitle,
        job_type: t.jobType,
        authority: t.role,
    }),

    getEmployees: async () => {
        const { data } = await employeeApi.fetchEmployees();
        return (data || []).map(employeeService.mapEmployeeFromDb);
    },

    saveEmployee: async (item: Employee, isUpdate: boolean = false) => {
        if (item.profileImage && typeof window !== 'undefined') {
            try {
                localStorage.setItem(`profile_image_${item.id}`, item.profileImage);
            } catch (e) {
                console.error('Failed to save profile image to localStorage', e);
            }
        }

        // 1. Sync with Supabase Auth (Create or Update Auth User)
        // We do this BEFORE DB save so we can get the auth_id
        let authId = item.authId;
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: item.code,
                    password: item.password, // This will update password if provided
                    name: item.name,
                    role: item.role
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Auth Sync Failed:', errorData);
                // We might want to throw here, or continue with a warning?
                // For now, let's throw so the user knows something is wrong.
                throw new Error(errorData.error || 'Failed to sync authentication account');
            }

            const result = await response.json();
            if (result.userId) {
                authId = result.userId;
            }
        } catch (error) {
            console.error('Auth Registration Error:', error);
            throw error; // Stop saving if auth fails
        }

        // 2. Prepare DB Data with auth_id
        const dbData = {
            ...employeeService.mapEmployeeToDb(item),
            auth_id: authId
        };

        if (isUpdate) {
            return await employeeApi.updateEmployee(item.id, dbData);
        } else {
            return await employeeApi.insertEmployee(dbData);
        }
    },

    deleteEmployee: async (id: string) => {
        return await employeeApi.deleteEmployee(id);
    },
    deleteEmployees: async (ids: string[]) => {
        return await employeeApi.deleteEmployees(ids);
    }
};
