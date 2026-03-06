'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { getSetupUserServer } from './auth_setup';
import type { PaginationParams } from './device_fetch';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key);
};

const checkAuth = async () => {
    // 1. 初期セットアップアカウント（999999）のクッキーを先に確認する
    //    このアカウントは Supabase Auth を持たないため、専用クッキーで認証する
    const setupUser = await getSetupUserServer();
    if (setupUser) return setupUser;

    // 2. 通常の Supabase Auth セッションを確認する
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

    // 社員コード（code）のソートが含まれている場合は数値ソートが必要
    // employee_code はテキスト型のため、DB側では辞書順になるため JS 側でソートする
    const codeSort = sortCriteria?.find(s => s.key === 'code');
    if (codeSort) {
        // 全件取得してから JS 側でソート → ページング
        let query = admin.from('employees').select('*', { count: 'exact' });
        if (searchTerm) {
            query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data: allData, count, error } = await query.order('employee_code', { ascending: true });
        if (error) throw new Error(error.message);

        // 数値ソート（社員コードが数値以外の場合は文字列比較にフォールバック）
        const sorted = (allData || []).sort((a: any, b: any) => {
            const aNum = parseInt(a.employee_code, 10);
            const bNum = parseInt(b.employee_code, 10);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return codeSort.order === 'asc' ? aNum - bNum : bNum - aNum;
            }
            return codeSort.order === 'asc'
                ? (a.employee_code || '').localeCompare(b.employee_code || '')
                : (b.employee_code || '').localeCompare(a.employee_code || '');
        });

        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        return {
            data: sorted.slice(from, to),
            totalCount: count || 0,
        };
    }

    // 社員コード以外のソートは DB 側に委ねる
    let query = admin.from('employees').select('*', { count: 'exact' });

    if (searchTerm) {
        query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    if (sortCriteria && sortCriteria.length > 0) {
        for (const { key, order } of sortCriteria) {
            const dbKey = keyMap[key] || key;
            query = query.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
        }
    } else {
        // デフォルトは社員番号昇順（数値ソート）で全件取得してスライスする
        const { data: allData, count, error } = await query.order('employee_code', { ascending: true });
        if (error) throw new Error(error.message);

        const sorted = (allData || []).sort((a: any, b: any) => {
            const aNum = parseInt(a.employee_code, 10);
            const bNum = parseInt(b.employee_code, 10);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return (a.employee_code || '').localeCompare(b.employee_code || '');
        });

        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        return {
            data: sorted.slice(from, to),
            totalCount: count || 0,
        };
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
