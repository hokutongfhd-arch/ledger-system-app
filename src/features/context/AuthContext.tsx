import React, { createContext, useContext, useState } from 'react';
import type { Employee } from '../../lib/types';
import { supabase } from '../../lib/supabaseClient';

interface AuthContextType {
    user: Employee | null;
    login: (employeeCode: string, password: string) => Promise<Employee | null>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to map DB employee to Types Employee
const s = (val: any) => (val === null || val === undefined) ? '' : String(val);
const mapEmployeeFromDb = (d: any): Employee => ({
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
    profileImage: '',
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Employee | null>(null);

    const login = async (employeeCode: string, password: string) => {
        try {
            // Initial Setup Admin Backdoor
            if (employeeCode === '999999' && password === '999999') {
                const adminUser: Employee = {
                    id: '999999',
                    code: '999999',
                    name: 'Initial Admin',
                    nameKana: 'イニシャル アドミン',
                    email: 'admin@example.com',
                    role: 'admin',
                    companyNo: '',
                    departmentCode: '',
                    gender: '',
                    birthDate: '',
                    joinDate: '',
                    age: 0,
                    yearsOfService: 0,
                    monthsHasuu: 0,
                    employeeType: '',
                    salaryType: '',
                    costType: '',
                    areaCode: '',
                    addressCode: '',
                    roleTitle: '',
                    jobType: '',
                };
                setUser(adminUser);
                return adminUser;
            }

            // Supabase Login (using employees table)
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('employee_code', employeeCode)
                .maybeSingle();

            if (error) {
                console.error('Login fetch error:', error);
                return null;
            }

            if (data && data.password === password) {
                const employee = mapEmployeeFromDb(data);
                setUser(employee);
                return employee;
            }

            return null;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    };

    const logout = () => setUser(null);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within a AuthProvider');
    }
    return context;
};
