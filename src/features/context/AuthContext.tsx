'use client';

import React, { createContext, useContext, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Employee } from '../../lib/types';
// import { supabase } from '../../lib/supabaseClient'; // REMOVE: Don't use static client for auth
import { logger } from '../../lib/logger';
import { loginInitialSetup, getSetupUserServer, logoutSetupAccount } from '../../app/actions/auth_setup';

interface AuthContextType {
    user: Employee | null;
    isLoading: boolean;
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
    areaCode: s(d.area_code),
    addressCode: s(d.address_code),
    role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    profileImage: typeof window !== 'undefined' ? localStorage.getItem(`profile_image_${d.id}`) || '' : '',
    authId: s(d.auth_id),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Create a Supabase client configured to use cookies
    const supabase = createClientComponentClient();

    const [user, setUser] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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

    // Initialize session on mount
    React.useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await refreshUser();
                } else {
                    // Check for setup account session
                    const setupUser = await getSetupUserServer();
                    if (setupUser) {
                        setUser(setupUser as Employee);
                    }
                }
            } catch (error) {
                console.error('Session init error:', error);
            } finally {
                setIsLoading(false);
            }
        };
        initSession();
    }, []);

    const login = async (employeeCode: string, password: string) => {
        try {
            // Supabase Auth Login (Pseudo-Email Strategy)
            if (employeeCode === '999999') {
                const setupResult = await loginInitialSetup(password);
                if (setupResult.success) {
                    const setupUser = {
                        id: 'INITIAL_SETUP_ACCOUNT',
                        code: '999999',
                        name: '初期セットアップアカウント',
                        role: 'admin' as const,
                    } as Employee;
                    setUser(setupUser);
                    return setupUser;
                }
                return null;
            }

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

            // Immediately refresh the router to allow server components/middleware to see the new cookie
            // useRouter().refresh() logic is handled by the caller or we can do manual handling here if needed.
            // But usually the client-side state update + router.push in LoginPage is enough *IF* cookies are set.

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

                // Auto-link the auth_id for future logins and auditing
                await supabase
                    .from('employees')
                    .update({ auth_id: authData.session.user.id })
                    .eq('id', fallbackData.id);

                const employee = mapEmployeeFromDb({ ...fallbackData, auth_id: authData.session.user.id });
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
        await logoutSetupAccount();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
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
