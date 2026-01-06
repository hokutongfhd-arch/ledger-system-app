import { deviceApi } from './device.api';
import type { Tablet, IPhone, FeaturePhone, Router, DeviceStatus } from './device.types';
import { formatPhoneNumber } from '../../lib/utils/phoneUtils';

// --- Data Mappers ---
const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

export const deviceService = {
    // Tablets
    mapTabletFromDb: (d: any): Tablet => ({
        id: d.id,
        terminalCode: s(d.terminal_code),
        maker: s(d.maker),
        modelNumber: s(d.model_number),
        officeCode: s(d.office_code),
        addressCode: s(d.address_code),
        address: s(d.address),
        notes: s(d.notes),
        history: s(d.lend_history),
        status: (d.status as DeviceStatus) || 'available',
        contractYears: s(d.contract_years),
        employeeCode: s(d.employee_code),
    }),
    mapTabletToDb: (t: Partial<Tablet>) => ({
        terminal_code: t.terminalCode,
        maker: t.maker,
        model_number: t.modelNumber,
        office_code: t.officeCode,
        address_code: t.addressCode,
        address: t.address,
        notes: t.notes,
        lend_history: t.history,
        status: t.status,
        contract_years: t.contractYears,
        employee_code: t.employeeCode,
    }),

    // IPhones
    mapIPhoneFromDb: (d: any): IPhone => ({
        id: d.id,
        carrier: s(d.carrier),
        phoneNumber: s(d.phone_number),
        managementNumber: s(d.management_number),
        employeeId: s(d.employee_code),
        addressCode: s(d.address_code),
        smartAddressId: s(d.smart_address_id),
        smartAddressPw: s(d.smart_address_pw),
        lendDate: s(d.lend_date),
        receiptDate: s(d.receipt_date),
        notes: s(d.notes),
        returnDate: s(d.return_date),
        modelName: s(d.model_name),
        status: '貸出中',
        contractYears: s(d.contract_years),
    }),
    mapIPhoneToDb: (t: Partial<IPhone>) => ({
        carrier: t.carrier,
        phone_number: t.phoneNumber ? formatPhoneNumber(t.phoneNumber) : t.phoneNumber,
        management_number: t.managementNumber,
        employee_code: t.employeeId,
        address_code: t.addressCode,
        smart_address_id: t.smartAddressId,
        smart_address_pw: t.smartAddressPw,
        lend_date: t.lendDate,
        receipt_date: t.receiptDate,
        notes: t.notes,
        return_date: t.returnDate,
        model_name: t.modelName,
        contract_years: t.contractYears,
    }),

    // FeaturePhones
    mapFeaturePhoneFromDb: (d: any): FeaturePhone => ({
        id: d.id,
        carrier: s(d.carrier),
        phoneNumber: s(d.phone_number),
        managementNumber: s(d.management_number),
        employeeId: s(d.employee_code),
        addressCode: s(d.address_code),
        costCompany: s(d.cost_company),
        lendDate: s(d.lend_date),
        receiptDate: s(d.receipt_date),
        notes: s(d.notes),
        returnDate: s(d.return_date),
        modelName: s(d.model_name),
        status: '貸出中',
        contractYears: s(d.contract_years),
    }),
    mapFeaturePhoneToDb: (t: Partial<FeaturePhone>) => ({
        carrier: t.carrier,
        phone_number: t.phoneNumber,
        management_number: t.managementNumber,
        employee_code: t.employeeId,
        address_code: t.addressCode,
        cost_company: t.costCompany,
        lend_date: t.lendDate,
        receipt_date: t.receiptDate,
        notes: t.notes,
        return_date: t.returnDate,
        model_name: t.modelName,
        contract_years: t.contractYears,
    }),

    // Routers
    mapRouterFromDb: (d: any): Router => ({
        id: d.id,
        no: s(d.no),
        biller: s(d.biller),
        terminalCode: s(d.terminal_code),
        modelNumber: s(d.model_number),
        carrier: s(d.carrier),
        cost: Number(d.cost) || 0,
        costTransfer: s(d.cost_transfer),
        dataCapacity: s(d.data_limit),
        simNumber: s(d.sim_number),
        ipAddress: s(d.ip_address),
        subnetMask: s(d.subnet_mask),
        startIp: s(d.start_ip),
        endIp: s(d.end_ip),
        company: s(d.company),
        addressCode: s(d.address_code),
        actualLender: s(d.actual_lender),
        costBearer: s(d.payer),
        actualLenderName: s(d.actual_lender_name),
        lendingHistory: s(d.lend_history),
        notes: s(d.notes),
        contractStatus: s(d.contract_status),
        returnDate: '',
        contractYears: s(d.contract_years),
        employeeCode: s(d.employee_code),
    }),
    mapRouterToDb: (t: Partial<Router>) => ({
        no: t.no,
        biller: t.biller,
        terminal_code: t.terminalCode,
        model_number: t.modelNumber,
        carrier: t.carrier,
        cost: String(t.cost),
        cost_transfer: t.costTransfer,
        data_limit: t.dataCapacity,
        sim_number: t.simNumber,
        ip_address: t.ipAddress,
        subnet_mask: t.subnetMask,
        start_ip: t.startIp,
        end_ip: t.endIp,
        company: t.company,
        address_code: t.addressCode,
        actual_lender: t.actualLender,
        payer: t.costBearer,
        actual_lender_name: t.actualLenderName,
        lend_history: t.lendingHistory,
        notes: t.notes,
        contract_status: t.contractStatus,
        contract_years: t.contractYears,
        employee_code: t.employeeCode,
    }),

    // Service methods
    getAllDevices: async () => {
        const [t, i, f, r] = await Promise.all([
            deviceApi.fetchTablets(),
            deviceApi.fetchIPhones(),
            deviceApi.fetchFeaturePhones(),
            deviceApi.fetchRouters(),
        ]);

        return {
            tablets: (t.data || []).map(deviceService.mapTabletFromDb),
            iphones: (i.data || []).map(deviceService.mapIPhoneFromDb),
            featurePhones: (f.data || []).map(deviceService.mapFeaturePhoneFromDb),
            routers: (r.data || []).map(deviceService.mapRouterFromDb),
        };
    },

    saveDevice: async (table: string, item: any, isUpdate: boolean = false) => {
        let dbData;
        if (table === 'tablets') dbData = deviceService.mapTabletToDb(item);
        else if (table === 'iphones') dbData = deviceService.mapIPhoneToDb(item);
        else if (table === 'featurephones') dbData = deviceService.mapFeaturePhoneToDb(item);
        else if (table === 'routers') dbData = deviceService.mapRouterToDb(item);
        else throw new Error(`Unknown table: ${table}`);

        if (isUpdate) {
            return await deviceApi.updateDevice(table, item.id, dbData);
        } else {
            return await deviceApi.insertDevice(table, dbData);
        }
    },

    deleteDevice: async (table: string, id: string) => {
        return await deviceApi.deleteDevice(table, id);
    }
};
