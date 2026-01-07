'use server';

import { cookies } from 'next/headers';

const SETUP_ID = '999999';
const SETUP_PASS = '999999';
const COOKIE_NAME = 'is_initial_setup';

export async function loginInitialSetup(password: string) {
    if (password === SETUP_PASS) {
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 2, // 2 hours
        });
        return { success: true };
    }
    return { success: false, error: 'Invalid password' };
}

export async function getSetupUserServer() {
    const cookieStore = await cookies();
    const isSetup = cookieStore.get(COOKIE_NAME);
    if (isSetup?.value === 'true') {
        return {
            id: 'INITIAL_SETUP_ACCOUNT',
            code: '999999',
            name: '初期セットアップアカウント',
            role: 'admin' as const,
        };
    }
    return null;
}

export async function logoutSetupAccount() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
