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

export async function getHighlightPage(baseQuery: any, highlightId: string, pageSize: number): Promise<number | undefined> {
    let hasMore = true;
    let currentOffset = 0;
    const fetchSize = 1000;
    let foundIndex = -1;

    while (hasMore) {
        const idQuery = baseQuery.select('id').range(currentOffset, currentOffset + fetchSize - 1);
        const { data: batchIds, error } = await idQuery;
        
        if (error || !batchIds || batchIds.length === 0) {
            break;
        }

        const batchIndex = batchIds.findIndex((item: any) => item.id === highlightId);
        if (batchIndex !== -1) {
            foundIndex = currentOffset + batchIndex;
            break;
        }

        if (batchIds.length < fetchSize) {
            hasMore = false;
        } else {
            currentOffset += fetchSize;
        }
    }

    if (foundIndex !== -1) {
        return Math.ceil((foundIndex + 1) / pageSize);
    }
    return undefined;
}

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
export async function fetchEmployeesPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
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

    let query = admin.from('employees').select('*', { count: 'exact' });

    if (searchTerm) {
        query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const codeSort = sortCriteria?.find(s => s.key === 'code');
    
    // In all cases, if we sort by code, or have no sort criteria, we JS-sort allData
    // If we JS-sort allData, we can easily find highlightPage
    
    if (codeSort || !sortCriteria || sortCriteria.length === 0) {
        const { data: allData, count, error } = await query.order('employee_code', { ascending: true });
        if (error) throw new Error(error.message);

        const sorted = (allData || []).sort((a: any, b: any) => {
            const aNum = parseInt(a.employee_code, 10);
            const bNum = parseInt(b.employee_code, 10);
            const isAsc = codeSort ? codeSort.order === 'asc' : true;
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return isAsc ? aNum - bNum : bNum - aNum;
            }
            return isAsc 
                ? (a.employee_code || '').localeCompare(b.employee_code || '')
                : (b.employee_code || '').localeCompare(a.employee_code || '');
        });

        let highlightPage: number | undefined;
        if (highlightId) {
            const index = sorted.findIndex((item: any) => item.id === highlightId);
            if (index !== -1) {
                highlightPage = Math.ceil((index + 1) / pageSize);
            }
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        return {
            data: sorted.slice(from, to),
            totalCount: count || 0,
            highlightPage
        };
    } else {
        // Handle DB sort
        const applyFiltersAndSort = (baseQuery: any) => {
            let q = baseQuery;
            if (searchTerm) {
                q = q.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
            }
            for (const { key, order } of sortCriteria) {
                const dbKey = keyMap[key] || key;
                q = q.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
            }
            return q;
        };

        let highlightPage: number | undefined;
        if (highlightId) {
            const idQuery = applyFiltersAndSort(admin.from('employees').select('id'));
            const { data: allIds } = await idQuery;
            const index = allIds?.findIndex((item: any) => item.id === highlightId) ?? -1;
            if (index !== -1) {
                highlightPage = Math.ceil((index + 1) / pageSize);
            }
        }

        query = applyFiltersAndSort(admin.from('employees').select('*', { count: 'exact' }));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, count, error } = await query.range(from, to);
        if (error) throw new Error(error.message);

        return {
            data: data || [],
            totalCount: count || 0,
            highlightPage
        };
    }
}


export async function fetchEmployeesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const allData: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
        let query = admin.from('employees')
            .select('*')
            .order('employee_code', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        
        if (searchTerm) {
            query = query.or(`employee_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,name_kana.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        } else {
            break;
        }
    }

    return allData;
}

// --- Addresses (Offices) ---
export async function fetchAddressesPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`no.ilike.%${searchTerm}%,address_code.ilike.%${searchTerm}%,office_name.ilike.%${searchTerm}%,tel.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,supervisor.ilike.%${searchTerm}%`);
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
                q = q.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
            }
        } else {
            q = q.order('no', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('addresses'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    let query = applyFiltersAndSort(admin.from('addresses').select('*', { count: 'exact' }));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return {
        data: data || [],
        totalCount: count || 0,
        highlightPage
    };
}

export async function fetchAddressesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    
    const allData: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
        let query = admin.from('addresses')
            .select('*')
            .order('no', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        
        if (searchTerm) {
            query = query.or(`no.ilike.%${searchTerm}%,address_code.ilike.%${searchTerm}%,office_name.ilike.%${searchTerm}%,tel.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,supervisor.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        } else {
            break;
        }
    }

    return allData;
}

// --- Areas ---
export async function fetchAreasPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`area_code.ilike.%${searchTerm}%,area_name.ilike.%${searchTerm}%`);
        }

        if (sortCriteria && sortCriteria.length > 0) {
            const keyMap: Record<string, string> = {
                areaCode: 'area_code',
                areaName: 'area_name'
            };
            for (const { key, order } of sortCriteria) {
                const dbKey = keyMap[key] || key;
                q = q.order(dbKey, { ascending: order === 'asc', nullsFirst: false });
            }
        } else {
            q = q.order('area_code', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('areas'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    let query = applyFiltersAndSort(admin.from('areas').select('*', { count: 'exact' }));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return {
        data: data || [],
        totalCount: count || 0,
        highlightPage
    };
}

export async function fetchAreasAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const allData: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
        let query = admin.from('areas')
            .select('*')
            .order('area_code', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        
        if (searchTerm) {
            query = query.or(`area_code.ilike.%${searchTerm}%,area_name.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
            allData.push(...data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        } else {
            break;
        }
    }

    return allData;
}
