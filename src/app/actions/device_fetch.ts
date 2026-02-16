'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

const checkAuth = async () => {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
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
