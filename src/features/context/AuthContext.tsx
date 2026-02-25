'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import type { Employee } from '../../lib/types';
// import { supabase } from '../../lib/supabaseClient'; // REMOVE: Don't use static client for auth
import { logger } from '../../lib/logger';
import { loginInitialSetup, getSetupUserServer, logoutSetupAccount } from '../../app/actions/auth_setup';
import { getLoginEmailAction, handleLoginFailureAction, handleLoginSuccessAction } from '@/app/actions/auth';

interface AuthContextType {
    user: Employee | null;
    isLoading: boolean;
    login: (employeeCode: string, password: string) => Promise<Employee | null>;
    logout: (shouldRedirect?: boolean) => Promise<void>;
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
    // Password is not stored in DB anymore
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
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
});

// Singleton pattern for Supabase client to prevent "Multiple GoTrueClient instances" in dev
const getSupabaseClient = () => {
    if (typeof window === 'undefined') return createClientComponentClient();

    if (process.env.NODE_ENV === 'development') {
        if (!(global as any)._supabaseClient) {
            (global as any)._supabaseClient = createClientComponentClient();
        }
        return (global as any)._supabaseClient;
    }
    return createClientComponentClient();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Use singleton or create new
    const [supabase] = useState(() => getSupabaseClient());

    const [user, setUser] = useState<Employee | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const refreshUser = useCallback(async () => {
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
    }, [supabase]);

    // Initialize session on mount
    React.useEffect(() => {
        const initSession = async () => {
            try {
                // Check if this tab has an active session flag (cleared on tab close)
                const isTabSessionActive = typeof window !== 'undefined' && sessionStorage.getItem('ledger_session_active') === 'true';

                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    // Check for specific refresh token errors
                    // "Invalid Refresh Token" or "Refresh Token Not Found" usually means the session is dead on server
                    if (error.message.includes('Refresh Token') || error.status === 400) {
                        console.warn('Invalid session detected (Refresh Token Error), clearing local auth.');
                        await supabase.auth.signOut({ scope: 'local' });
                        setUser(null);
                        return;
                    } else {
                        throw error;
                    }
                }

                if (session) {
                    // If we have a cookie session but NO tab session flag, it means the browser/tab was likely closed and reopened (fresh start).
                    // Enforce logout to require fresh login.
                    if (!isTabSessionActive) {
                        console.warn('Session cookie found but no active tab session. Forcing logout to enforce login on app open.');
                        await supabase.auth.signOut();
                        setUser(null);
                        // Ensure we are redirecting to login if not already there/handled by middleware?
                        // Middleware might let us through if cookie is valid, so we must kill the cookie.
                        // After signOut, state change should trigger re-render or middleware check on next nav.
                        return;
                    }

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
    }, [refreshUser, supabase]);

    const login = useCallback(async (employeeCode: string, password: string) => {
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

                // 失敗回数の更新と取得
                const failureStatus = await handleLoginFailureAction(employeeCode);
                const isAlertThreshold = failureStatus.count >= 5;

                if (isAlertThreshold) {
                    // 5回目以上の場合は「異常検知」ログのみを記録
                    await logger.log({
                        action: 'ANOMALY_DETECTED',
                        targetType: 'auth',
                        message: `同一社員外部コード(${employeeCode})による連続ログイン失敗を検知しました (${failureStatus.count}回)`,
                        actor: { employeeCode },
                        result: 'failure',
                        isAcknowledged: false, // 異常検知は明示的に「未対応」として開始
                        severity: 'high' as any,
                        metadata: {
                            failureCount: failureStatus.count,
                            type: 'LOGIN_BRUTE_FORCE',
                            error: authError,
                            isRegistered: failureStatus.isRegistered
                        }
                    });
                } else {
                    // 1〜4回目は通常の失敗ログのみを記録
                    await logger.log({
                        action: 'LOGIN_FAILURE',
                        targetType: 'auth',
                        message: `ログイン失敗${failureStatus.count}回目`,
                        actor: { employeeCode },
                        result: 'failure',
                        metadata: {
                            error: authError,
                            failureCount: failureStatus.count,
                            isRegistered: failureStatus.isRegistered
                        }
                    });
                }
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
            // バッジの再取得を NotificationContext に通知（router.refresh 後の State リセット対策）
            if (typeof window !== 'undefined') {
                setTimeout(() => window.dispatchEvent(new CustomEvent('notification-refresh')), 300);
            }

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
            console.log(`[AuthContext] Profile Fetched: Code=${employee.code}, Authority=${employeeData.authority} -> Role=${employee.role}`); // Debug Log
            setUser(employee);

            // ログイン成功時に失敗回数をリセット
            await handleLoginSuccessAction(employee.code);

            await logger.info({
                action: 'LOGIN_SUCCESS',
                targetType: 'auth',
                actor: { authId: authData.session.user.id, employeeCode: employee.code, name: employee.name }
            });
            // Mark session as active for this tab
            if (typeof window !== 'undefined') sessionStorage.setItem('ledger_session_active', 'true');
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
    }, [router, supabase]);

    const logout = useCallback(async (shouldRedirect: boolean = true) => {
        try {
            if (user) {
                // ログの失敗がログアウトを邪魔しないようにする
                await logger.info({
                    action: 'LOGOUT',
                    targetType: 'auth',
                    actor: { employeeCode: user.code, name: user.name }
                }).catch(err => console.warn('Logout log failed:', err));
            }

            // Check session before global sign out to prevent 403
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await supabase.auth.signOut().catch((err: any) => console.warn('SignOut failed:', err));
            } else {
                // Even if no session, ensure local storage is cleared
                await supabase.auth.signOut({ scope: 'local' }).catch((err: any) => console.warn('Local SignOut failed:', err));
            }

            await logoutSetupAccount().catch((err: any) => console.warn('Logout setup account failed:', err));
            if (typeof window !== 'undefined') sessionStorage.removeItem('ledger_session_active');
            setUser(null);
        } catch (error) {
            console.error('Logout process error:', error);
        } finally {
            // 確実にログイン画面へ飛ばす (Requested)
            if (shouldRedirect) {
                window.location.href = '/login';
            }
        }
    }, [user, supabase]);

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
