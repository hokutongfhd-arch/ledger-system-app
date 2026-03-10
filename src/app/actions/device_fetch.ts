'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { getSetupUserServer } from './auth_setup';
import { getHighlightPage } from './master_fetch';

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

export interface PaginationParams {
    page: number;
    pageSize: number;
    searchTerm?: string;
    sortCriteria?: { key: string; order: 'asc' | 'desc' }[];
    highlightId?: string;
}

export async function fetchIPhonesPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`management_number.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,model_name.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        if (sortCriteria && sortCriteria.length > 0) {
            const keyMap: Record<string, string> = {
                managementNumber: 'management_number',
                phoneNumber: 'phone_number',
                modelName: 'model_name',
                contractYears: 'contract_years',
                carrier: 'carrier',
                status: 'status',
                employeeCode: 'employee_code',
                addressCode: 'address_code',
            };
            for (const criterion of sortCriteria) {
                const dbKey = keyMap[criterion.key] || criterion.key;
                q = q.order(dbKey, { ascending: criterion.order === 'asc' });
            }
        } else {
            q = q.order('management_number', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('iphones'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    let query = applyFiltersAndSort(admin.from('iphones').select('*', { count: 'exact' }));
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { data: data || [], totalCount: count || 0, highlightPage };
}

export async function fetchIPhonesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    
    let query = admin.from('iphones').select('*').order('management_number', { ascending: true });
    if (searchTerm) {
        query = query.or(`management_number.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,model_name.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchTabletsAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('tablets').select('*').order('terminal_code', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchTabletsPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`terminal_code.ilike.%${searchTerm}%,maker.ilike.%${searchTerm}%,model_number.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        if (sortCriteria && sortCriteria.length > 0) {
            const keyMap: Record<string, string> = {
                terminalCode: 'terminal_code',
                contractYears: 'contract_years',
                status: 'status',
                employeeCode: 'employee_code',
                addressCode: 'address_code',
            };
            for (const criterion of sortCriteria) {
                const dbKey = keyMap[criterion.key] || criterion.key;
                q = q.order(dbKey, { ascending: criterion.order === 'asc' });
            }
        } else {
            q = q.order('terminal_code', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('tablets'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    console.log(`[Server] tablets pagination requested. Page=${page}, pageSize=${pageSize}, highlightId=${highlightId}, returning highlightPage=${highlightPage}`);

    let query = applyFiltersAndSort(admin.from('tablets').select('*', { count: 'exact' }));
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { data: data || [], totalCount: count || 0, highlightPage };
}

export async function fetchTabletsAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('tablets').select('*').order('terminal_code', { ascending: true });
    if (searchTerm) {
        query = query.or(`terminal_code.ilike.%${searchTerm}%,maker.ilike.%${searchTerm}%,model_number.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchFeaturePhonesAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('featurephones').select('*').order('management_number', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchFeaturePhonesPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`management_number.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,model_name.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        if (sortCriteria && sortCriteria.length > 0) {
            const keyMap: Record<string, string> = {
                managementNumber: 'management_number',
                phoneNumber: 'phone_number',
                modelName: 'model_name',
                contractYears: 'contract_years',
                carrier: 'carrier',
                status: 'status',
                employeeCode: 'employee_code',
                addressCode: 'address_code',
            };
            for (const criterion of sortCriteria) {
                const dbKey = keyMap[criterion.key] || criterion.key;
                q = q.order(dbKey, { ascending: criterion.order === 'asc' });
            }
        } else {
            q = q.order('management_number', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('featurephones'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    let query = applyFiltersAndSort(admin.from('featurephones').select('*', { count: 'exact' }));
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { data: data || [], totalCount: count || 0, highlightPage };
}

export async function fetchFeaturePhonesAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('featurephones').select('*').order('management_number', { ascending: true });
    if (searchTerm) {
        query = query.or(`management_number.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%,model_name.ilike.%${searchTerm}%,carrier.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchRoutersAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('routers').select('*').order('no', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchRoutersPaginatedAction({ page, pageSize, searchTerm, sortCriteria, highlightId }: PaginationParams) {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const applyFiltersAndSort = (baseQuery: any) => {
        let q = baseQuery;
        if (searchTerm) {
            q = q.or(`no.ilike.%${searchTerm}%,terminal_code.ilike.%${searchTerm}%,sim_number.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        if (sortCriteria && sortCriteria.length > 0) {
            const keyMap: Record<string, string> = {
                no: 'no',
                terminalCode: 'terminal_code',
                contractYears: 'contract_years',
                status: 'status',
                employeeCode: 'employee_code',
                addressCode: 'address_code',
                simNumber: 'sim_number',
                ipAddress: 'ip_address'
            };
            for (const criterion of sortCriteria) {
                const dbKey = keyMap[criterion.key] || criterion.key;
                q = q.order(dbKey, { ascending: criterion.order === 'asc' });
            }
        } else {
            q = q.order('no', { ascending: true });
        }
        return q;
    };

    let highlightPage: number | undefined;
    if (highlightId) {
        const baseQuery = applyFiltersAndSort(admin.from('routers'));
        highlightPage = await getHighlightPage(baseQuery, highlightId, pageSize);
    }

    let query = applyFiltersAndSort(admin.from('routers').select('*', { count: 'exact' }));
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { data: data || [], totalCount: count || 0, highlightPage };
}

export async function fetchRoutersAllAction(searchTerm?: string) {
    await checkAuth();
    const admin = getSupabaseAdmin();
    let query = admin.from('routers').select('*').order('no', { ascending: true });
    if (searchTerm) {
        query = query.or(`no.ilike.%${searchTerm}%,terminal_code.ilike.%${searchTerm}%,sim_number.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchAreasAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();
    
    const allData: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
        const { data, error } = await admin.from('areas')
            .select('*')
            .order('area_code', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        
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

export async function fetchAddressesAction() {
    await checkAuth();
    const admin = getSupabaseAdmin();

    const allData: any[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    while (true) {
        const { data, error } = await admin.from('addresses')
            .select('*')
            .order('address_code', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        
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
