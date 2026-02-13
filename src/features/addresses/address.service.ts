import { supabase } from '../../lib/supabaseClient';
import type { Address } from '../../lib/types';

const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const addressApi = {
    fetchAddresses: async () => {
        return await supabase.from('addresses').select('*');
    },
    insertAddress: async (data: any) => {
        return await supabase.from('addresses').insert(data).select().single();
    },
    updateAddress: async (id: string, data: any) => {
        return await supabase.from('addresses').update(data).eq('id', id);
    },
    deleteAddress: async (id: string) => {
        return await supabase.from('addresses').delete().eq('id', id);
    },
    deleteAddresses: async (ids: string[]) => {
        return await supabase.from('addresses').delete().in('id', ids);
    }
};

export const addressService = {
    mapAddressFromDb: (d: any): Address => ({
        id: d.id,
        no: s(d.no),
        addressCode: s(d.address_code),
        officeName: s(d.office_name),
        tel: s(d.tel),
        fax: s(d.fax),

        zipCode: s(d.zip),
        address: s(d.address),
        notes: s(d.notes),
        division: s(d.department),
        area: s(d.area),
        mainPerson: s(d.supervisor),
        branchNumber: s(d.branch_no),
        specialNote: s(d.remarks),
        labelName: s(d.label_name),
        labelZip: s(d.label_zip),
        labelAddress: s(d.label_address),
        attentionNote: s(d.caution),
        accountingCode: s(d.accounting_code),
    }),

    mapAddressToDb: (t: Partial<Address>) => ({
        no: t.no,
        address_code: t.addressCode,
        office_name: t.officeName,
        tel: t.tel,
        fax: t.fax,

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
    }),

    getAddresses: async () => {
        const { data } = await addressApi.fetchAddresses();
        return (data || []).map(addressService.mapAddressFromDb);
    },

    saveAddress: async (item: Address, isUpdate: boolean = false) => {
        const dbData = addressService.mapAddressToDb(item);
        if (isUpdate) {
            return await addressApi.updateAddress(item.id, dbData);
        } else {
            return await addressApi.insertAddress(dbData);
        }
    },

    deleteAddress: async (id: string) => {
        return await addressApi.deleteAddress(id);
    },
    deleteAddresses: async (ids: string[]) => {
        return await addressApi.deleteAddresses(ids);
    }
};
