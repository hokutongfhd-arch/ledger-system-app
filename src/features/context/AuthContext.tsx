'use client';

import React, { createContext, useContext, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import type { Employee } from '../../lib/types';
// import { supabase } from '../../lib/supabaseClient'; // REMOVE: Don't use static client for auth
import { logger } from '../../lib/logger';
import { loginInitialSetup, getSetupUserServer, logoutSetupAccount } from '../../app/actions/auth_setup';
import { getLoginEmailAction } from '@/app/actions/auth';

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
    password: '', // Password is not stored in DB anymore
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
    // Create a Supabase client configured to use cookies - Memoized to prevent multiple instances
    const [supabase] = useState(() => createClientComponentClient());

    const [user, setUser] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            // Use Secure API to fetch profile (bypasses RLS for unlinked users)
            const response = await fetch('/api/auth/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // Metadata fallback used inside API
            });

            if (response.ok) {
                const { employee: employeeData } = await response.json();
                const employee = mapEmployeeFromDb(employeeData);
                setUser(employee);
            } else {
                console.error('Failed to find employee profile for session user. Forcing logout.');
                // alert('アカウント情報が見つかりませんでした。再度ログインしてください。'); // Alert might be annoying on simple refresh
                await supabase.auth.signOut();
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    };

    // Initialize session on mount
    React.useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    // Refresh Token が無効または見つからない場合
                    if (error.message.includes('Refresh Token') || error.status === 400) {
                        console.warn('Invalid session detected, clearing local auth:', error.message);
                        await supabase.auth.signOut({ scope: 'local' });
                    } else {
                        throw error;
                    }
                }

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
                    // Refresh server state
                    router.refresh();
                    return setupUser;
                }
                return null;
            }

            // 1. Resolve Auth Email from Employee Code
            const resolvedEmail = await getLoginEmailAction(employeeCode);
            const loginEmail = resolvedEmail || `${employeeCode}@ledger-system.local`;

            console.log(`Login attempt for Code: ${employeeCode} -> Resolved Email: ${loginEmail}`);

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
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
            router.refresh();

            // Fetch Employee Profile linked to this Auth User via Secure API
            // This handles RLS bypass and auto-linking if necessary
            const profileResponse = await fetch('/api/auth/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employeeCode }), // Pass code for fallback linking
            });

            if (!profileResponse.ok) {
                const errorText = await profileResponse.text();
                console.error(`Login failed: Profile API Error [${profileResponse.status}]`, errorText);
                await supabase.auth.signOut();
                await logger.log({
                    action: 'LOGIN_FAILURE',
                    targetType: 'auth',
                    message: `Profile API Failed: ${profileResponse.status} - ${errorText}`,
                    actor: { authId: authData.session.user.id, employeeCode },
                    result: 'failure'
                });
                return null;
            }

            const { employee: employeeData } = await profileResponse.json();

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
        try {
            if (user) {
                // ログの失敗がログアウトを邪魔しないようにする
                await logger.info({
                    action: 'LOGOUT',
                    targetType: 'auth',
                    actor: { employeeCode: user.code, name: user.name }
                }).catch(err => console.warn('Logout log failed:', err));
            }
            await supabase.auth.signOut().catch(err => console.warn('SignOut failed:', err));
            await logoutSetupAccount().catch(err => console.warn('Logout setup account failed:', err));
            setUser(null);
        } catch (error) {
            console.error('Logout process error:', error);
        } finally {
            // 確実にログイン画面へ飛ばす
            window.location.href = '/login';
        }
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
