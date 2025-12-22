'use client';

import React, { createContext, useContext, useState } from 'react';
import type { Employee } from '../../lib/types';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

interface AuthContextType {
    user: Employee | null;
    login: (employeeCode: string, password: string) => Promise<Employee | null>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
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
    profileImage: typeof window !== 'undefined' ? localStorage.getItem(`profile_image_${d.id}`) || '' : '',
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Employee | null>(null);

    const login = async (employeeCode: string, password: string) => {
        try {
            // Supabase Auth Login (Pseudo-Email Strategy)
            const email = `${employeeCode}@ledger-system.local`;

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                console.warn('Auth Login Failed:', authError.message);
                await logger.log({
                    action: 'LOGIN_FAILURE',
                    targetType: 'auth',
                    message: authError.message || 'Supabase Auth Sign-In Failed',
                    actor: { employeeCode },
                    result: 'failure',
                    metadata: { error: authError }
                });
                return null;
            }

            if (!authData.session) {
                console.warn('Login Succeeded but No Session Returned');
                await logger.log({
                    action: 'LOGIN_FAILURE',
                    targetType: 'auth',
                    message: 'No Session returned after sign-in',
                    actor: { employeeCode },
                    result: 'failure'
                });
                return null;
            }

            // Fetch Employee Profile linked to this Auth User
            const { data: employeeData, error: dbError } = await supabase
                .from('employees')
                .select('*')
                .eq('auth_id', authData.session.user.id)
                .single();

            // Fallback: If auth_id link is missing (during migration gap), try matching by code
            // This is a safety net but ideally auth_id should be populated.
            if (dbError || !employeeData) {
                console.warn('Profile not found via auth_id, trying code fallback...');
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('employees')
                    .select('*')
                    .eq('employee_code', employeeCode)
                    .single();

                if (fallbackError || !fallbackData) {
                    console.error('Login failed: Profile not found.');
                    await supabase.auth.signOut(); // Force logout if no profile
                    await logger.log({
                        action: 'LOGIN_FAILURE',
                        targetType: 'auth',
                        message: 'Profile not found after Auth Success',
                        actor: { authId: authData.session.user.id, employeeCode },
                        result: 'failure',
                        metadata: { reason: 'Profile Not Found' }
                    });
                    return null;
                }

                const employee = mapEmployeeFromDb(fallbackData);
                setUser(employee);
                await logger.info({
                    action: 'LOGIN_SUCCESS',
                    targetType: 'auth',
                    actor: { authId: authData.session.user.id, employeeCode: employee.code, name: employee.name }
                });
                return employee;
            }

            const employee = mapEmployeeFromDb(employeeData);
            setUser(employee);
            await logger.info({
                action: 'LOGIN_SUCCESS',
                targetType: 'auth',
                actor: { authId: authData.session.user.id, employeeCode: employee.code, name: employee.name }
            });
            return employee;

        } catch (error: any) {
            console.error('Login unexpected error:', error);
            await logger.log({
                action: 'LOGIN_FAILURE',
                targetType: 'auth',
                message: 'Unexpected Error during Login',
                actor: { employeeCode },
                result: 'failure',
                metadata: { error: error }
            });
            return null;
        }
    };

    const logout = async () => {
        if (user) {
            await logger.info({
                action: 'LOGOUT',
                targetType: 'auth',
                actor: { employeeCode: user.code, name: user.name }
            });
        }
        await supabase.auth.signOut();
        setUser(null);
    };

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            // Re-fetch profile
            const { data: employeeData } = await supabase
                .from('employees')
                .select('*')
                .eq('auth_id', session.user.id)
                .single();

            if (employeeData) {
                const employee = mapEmployeeFromDb(employeeData);
                setUser(employee);
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
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
