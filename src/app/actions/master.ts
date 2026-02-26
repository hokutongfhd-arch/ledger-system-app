'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Area, Address } from '@/lib/types';

const getSupabase = async () => {
    try {
        const cookieStore = await cookies();
        return createServerActionClient({ cookies: () => cookieStore as any });
    } catch (e) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        return createClient(url, key);
    }
};

// --- Area Actions ---

export async function createAreaAction(data: Partial<Area>) {
    try {
        const supabase = await getSupabase();
        const { data: result, error } = await supabase
            .from('areas')
            .insert({ area_code: data.areaCode, area_name: data.areaName, version: 1 })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
            return { success: false, error: error.message };
        }
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function updateAreaAction(id: string, data: Partial<Area>, version: number) {
    const supabase = await getSupabase();
    const { data: updated, error } = await supabase
        .from('areas')
        .update({ area_name: data.areaName, version: version + 1 })
        .eq('area_code', id)
        .eq('version', version)
        .select();

    if (error) {
        if (error.code === '23505') return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
        return { success: false, error: error.message };
    }

    if (!updated || updated.length === 0) {
        return { success: false, error: 'ConcurrencyError' };
    }

    return { success: true, data: updated[0] };
}

export async function deleteAreaAction(id: string, version: number) {
    try {
        const supabase = await getSupabase();
        const { count, error } = await supabase
            .from('areas')
            .delete({ count: 'exact' })
            .eq('area_code', id)
            .eq('version', version);

        if (error) {
            return { success: false, error: error.message };
        }

        if (count === 0) {
            return { success: false, error: 'NotFoundError' };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function deleteManyAreasAction(items: { id: string, version: number }[]) {
    try {
        const supabase = await getSupabase();
        // We need to perform individual deletes to respect version check per item,
        // but doing it on the server avoids multiple client-server trips.
        const results = await Promise.all(items.map(async (item) => {
            const { count, error } = await supabase
                .from('areas')
                .delete({ count: 'exact' })
                .eq('area_code', item.id)
                .eq('version', item.version);
            return { id: item.id, success: !error && (count ?? 0) > 0, error: error?.message };
        }));

        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            return { success: false, error: failures[0].error || 'NotFoundError' };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}

// --- Address Actions ---

const mapAddressToDb = (t: Partial<Address>) => ({
    no: t.no,
    address_code: t.addressCode,
    office_name: t.officeName,
    tel: t.tel,
    fax: t.fax,
    category: t.type,
    zip: t.zipCode,
    address: t.address,
    notes: t.notes,
    department: t.division,
    area: t.area,
    supervisor: t.mainPerson,
    branch_no: t.branchNumber,
    remarks: t.specialNote,
    label_name: t.labelName,
    label_zip: t.labelZip,
    label_address: t.labelAddress,
    caution: t.attentionNote,
    accounting_code: t.accountingCode,
});

export async function createAddressAction(data: Partial<Address>) {
    try {
        const supabase = await getSupabase();
        const dbData = mapAddressToDb(data);
        const { data: result, error } = await supabase
            .from('addresses')
            .insert({ ...dbData, version: 1 })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
            return { success: false, error: error.message };
        }
        return { success: true, data: result };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function updateAddressAction(id: string, data: Partial<Address>, version: number) {
    const supabase = await getSupabase();
    const dbData = mapAddressToDb(data);
    const { data: updated, error } = await supabase
        .from('addresses')
        .update({ ...dbData, version: version + 1 })
        .eq('id', id)
        .eq('version', version)
        .select();

    if (error) {
        if (error.code === '23505') return { success: false, error: `DuplicateError: ${JSON.stringify(error)}` };
        return { success: false, error: error.message };
    }

    if (!updated || updated.length === 0) {
        return { success: false, error: 'ConcurrencyError' };
    }

    return { success: true, data: updated[0] };
}

export async function deleteAddressAction(id: string, version: number) {
    try {
        const supabase = await getSupabase();
        const { count, error } = await supabase
            .from('addresses')
            .delete({ count: 'exact' })
            .eq('id', id)
            .eq('version', version);

        if (error) {
            return { success: false, error: error.message };
        }

        if (count === 0) {
            return { success: false, error: 'NotFoundError' };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}

export async function deleteManyAddressesAction(items: { id: string, version: number }[]) {
    try {
        const supabase = await getSupabase();
        const results = await Promise.all(items.map(async (item) => {
            const { count, error } = await supabase
                .from('addresses')
                .delete({ count: 'exact' })
                .eq('id', item.id)
                .eq('version', item.version);
            return { id: item.id, success: !error && (count ?? 0) > 0, error: error?.message };
        }));

        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
            return { success: false, error: failures[0].error || 'NotFoundError' };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Unknown error' };
    }
}
