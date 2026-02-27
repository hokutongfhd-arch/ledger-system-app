'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { getSetupUserServer } from './auth_setup';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

const checkAuth = async () => {
    // 1. Check for Setup User first
    const setupUser = await getSetupUserServer();
    if (setupUser) return setupUser;

    // 2. Check for Supabase Auth User
    const cookieStore = await cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore as any });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthenticated');
    return user;
};

export async function fetchIPhonesAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('iphones').select('*').order('management_number', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchTabletsAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('tablets').select('*').order('terminal_code', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchFeaturePhonesAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('featurephones').select('*').order('management_number', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchRoutersAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('routers').select('*').order('no', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchAreasAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('areas').select('*').order('area_code', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchAddressesAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('addresses').select('*').order('address_code', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}
