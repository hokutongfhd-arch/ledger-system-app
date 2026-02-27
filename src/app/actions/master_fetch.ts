'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import type { PaginationParams } from './device_fetch';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

const checkAuth = async () => {
    const cookieStore = await cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore as any });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthenticated');
    return user;
};

// --- Employees ---
export async function fetchEmployeesPaginatedAction({ page, pageSize, searchTerm, sortCriteria }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    let query = admin.from('employees').select('*', { count: 'exact' });

    if (searchTerm) {
        query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    if (sortCriteria && sortCriteria.length > 0) {
        const keyMap: Record<string, string> = {
            code: 'employee_code',
            name: 'name',
            nameKana: 'name_kana',
            email: 'email',
            joinDate: 'join_date',
            role: 'authority',
            areaCode: 'area_code',
            addressCode: 'address_code',
        };
        for (const { key, order } of sortCriteria) {
            const dbKey = keyMap[key] || key;
            query = query.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
        }
    } else {
        query = query.order('employee_code', { ascending: true });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) throw new Error(error.message);

    return {
        data: data || [],
        totalCount: count || 0,
    };
}

export async function fetchEmployeesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('employees').select('*').order('employee_code', { ascending: true });
    
    if (searchTerm) {
        query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

// --- Addresses (Offices) ---
export async function fetchAddressesPaginatedAction({ page, pageSize, searchTerm, sortCriteria }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    let query = admin.from('addresses').select('*', { count: 'exact' });

    if (searchTerm) {
        query = query.or(`no.ilike.%${searchTerm}%,address_code.ilike.%${searchTerm}%,office_name.ilike.%${searchTerm}%,tel.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,supervisor.ilike.%${searchTerm}%`);
    }

    if (sortCriteria && sortCriteria.length > 0) {
        const keyMap: Record<string, string> = {
            no: 'no',
            addressCode: 'address_code',
            officeName: 'office_name',
            tel: 'tel',
            fax: 'fax',
            type: 'category',
            zipCode: 'zip',
            address: 'address',
            notes: 'notes',
            supervisor: 'supervisor',
            area: 'area'
        };
        for (const { key, order } of sortCriteria) {
            const dbKey = keyMap[key] || key;
            query = query.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
        }
    } else {
        query = query.order('no', { ascending: true });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) throw new Error(error.message);

    return {
        data: data || [],
        totalCount: count || 0,
    };
}

export async function fetchAddressesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('addresses').select('*').order('no', { ascending: true });
    
    if (searchTerm) {
        query = query.or(`no.ilike.%${searchTerm}%,address_code.ilike.%${searchTerm}%,office_name.ilike.%${searchTerm}%,tel.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,supervisor.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}

// --- Areas ---
export async function fetchAreasPaginatedAction({ page, pageSize, searchTerm, sortCriteria }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    let query = admin.from('areas').select('*', { count: 'exact' });

    if (searchTerm) {
        query = query.or(`area_code.ilike.%${searchTerm}%,area_name.ilike.%${searchTerm}%`);
    }

    if (sortCriteria && sortCriteria.length > 0) {
        const keyMap: Record<string, string> = {
            areaCode: 'area_code',
            areaName: 'area_name'
        };
        for (const { key, order } of sortCriteria) {
            const dbKey = keyMap[key] || key;
            query = query.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
        }
    } else {
        query = query.order('area_code', { ascending: true });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) throw new Error(error.message);

    return {
        data: data || [],
        totalCount: count || 0,
    };
}

export async function fetchAreasAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('areas').select('*').order('area_code', { ascending: true });
    
    if (searchTerm) {
        query = query.or(`area_code.ilike.%${searchTerm}%,area_name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
}
