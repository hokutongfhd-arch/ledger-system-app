import { employeeApi } from './employee.api';
import type { Employee, EmployeeInput } from './employee.types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const employeeService = {
    mapEmployeeFromDb: (d: any): Employee => ({
        id: d.id,
        code: s(d.employee_code),
        name: s(d.name),
        nameKana: s(d.name_kana),
        companyNo: '',
        departmentCode: '',
        email: s(d.email),
        gender: s(d.gender),
        birthDate: s(d.birthday),
        joinDate: s(d.join_date),
        age: Number(d.age_at_month_end) || 0,
        yearsOfService: Number(d.years_in_service) || 0,
        monthsHasuu: Number(d.months_in_service) || 0,
        areaCode: s(d.area_code),
        addressCode: s(d.address_code),
        role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        profileImage: typeof window !== 'undefined' ? (localStorage.getItem(`profile_image_${d.id}`) || '') : '',
        authId: s(d.auth_id),
    }),

    mapEmployeeToDb: (t: Partial<Employee>) => ({
        employee_code: t.code,
        email: t.email, // Add email to DB mapping
        // password: t.password, // Removed to prevent storing plain text password in DB
        name: t.name,
        name_kana: t.nameKana,
        gender: t.gender,
        birthday: t.birthDate,
        join_date: t.joinDate,
        age_at_month_end: String(t.age),
        years_in_service: String(t.yearsOfService),
        months_in_service: String(t.monthsHasuu),
        area_code: t.areaCode,
        address_code: t.addressCode,
        authority: t.role,
    }),

    getEmployees: async () => {
        const { data } = await employeeApi.fetchEmployees();
        return (data || []).map(employeeService.mapEmployeeFromDb);
    },

    saveEmployee: async (item: EmployeeInput & { id?: string }, isUpdate: boolean = false) => {
        if (item.profileImage && typeof window !== 'undefined') {
            try {
                localStorage.setItem(`profile_image_${item.id}`, item.profileImage);
            } catch (e: any) {
                console.error('Failed to save profile image to localStorage', e);
            }
        }

        // Call the Unified Upsert API
        try {
            const response = await fetch('/api/admin/employees/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_code: item.code,
                    email: item.email,
                    password: item.password,
                    name: item.name,
                    name_kana: item.nameKana,
                    gender: item.gender,
                    birthday: item.birthDate,
                    join_date: item.joinDate,
                    age_at_month_end: String(item.age),
                    years_in_service: String(item.yearsOfService),
                    months_in_service: String(item.monthsHasuu),
                    area_code: item.areaCode,
                    address_code: item.addressCode,
                    authority: item.role,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save employee');
            }

            const result = await response.json();
            return employeeService.mapEmployeeFromDb(result.employee);

        } catch (error) {
            console.error('Save Employee Error:', error);
            throw error;
        }
    },

    saveEmployeesBulk: async (items: EmployeeInput[]) => {
        // Reduced chunk size to 10 for safer processing (Hobby Plan limit)
        const CHUNK_SIZE = 10;
        const results = {
            successCount: 0,
            failureCount: 0,
            totalProcessed: 0,
            errors: [] as string[],
            validationErrors: [] as string[]
        };

        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);

            try {
                // Prepare payload
                const payload = chunk.map(item => ({
                    employee_code: item.code,
                    email: item.email,
                    password: item.password,
                    name: item.name,
                    name_kana: item.nameKana,
                    gender: item.gender,
                    birthday: item.birthDate,
                    join_date: item.joinDate,
                    age_at_month_end: String(item.age),
                    years_in_service: String(item.yearsOfService),
                    months_in_service: String(item.monthsHasuu),
                    area_code: item.areaCode,
                    address_code: item.addressCode,
                    authority: item.role,
                }));

                const response = await fetch('/api/admin/employees/bulk-upsert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employees: payload }),
                });

                if (!response.ok) {
                    // HTTP 400 はメール重複など構造的エラー
                    const errData = await response.json().catch(() => ({}));
                    if (response.status === 400 && errData.validationErrors) {
                        results.validationErrors = errData.validationErrors;
                        results.failureCount += chunk.length;
                        return results; // 即座に中断して結果を返す
                    }
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const data = await response.json();
                results.successCount += data.successCount || 0;
                results.failureCount += data.failureCount || 0;
                results.totalProcessed += chunk.length;

                if (data.results) {
                    data.results.forEach((r: any) => {
                        if (!r.success) {
                            results.errors.push(`Code ${r.code}: ${r.error}`);
                        }
                    });
                }

            } catch (error: any) {
                console.error('Bulk Save Chunk Error:', error);
                // 既に結果オブジェクト（results.validationErrors）を返して中断するパスを通っているため、
                // ここでの特別な処理は不要だが、万が一の他のエラーを拾う
                results.failureCount += chunk.length;
                results.errors.push(`Chunk ${i / CHUNK_SIZE + 1} Error: ${error.message}`);
            }
        }
        return results;
    },

    deleteEmployee: async (id: string) => {
        return await employeeApi.deleteEmployee(id);
    },
    deleteEmployees: async (ids: string[]) => {
        return await employeeApi.deleteEmployees(ids);
    }
};
