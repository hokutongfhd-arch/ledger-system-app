'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Tablet, IPhone, FeaturePhone, Router, Employee, Area, Address, Log, DeviceStatus } from '../../lib/types';
import { useAuth } from './AuthContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getWeekRange } from '../../lib/utils/dateHelpers';
import { logger, LogActionType, TargetType } from '../../lib/logger';
import { useToast } from './ToastContext';
import { logService } from '../logs/log.service';
import { createEmployeeBySetupAdmin, updateEmployeeBySetupAdmin, deleteEmployeeBySetupAdmin, deleteManyEmployeesBySetupAdmin } from '@/app/actions/employee_setup';
import { createEmployeeAction, fetchEmployeesAction, deleteEmployeeAction, deleteManyEmployeesAction, updateEmployeeAction } from '@/app/actions/employee';
import { updateIPhoneAction, updateFeaturePhoneAction, updateTabletAction, updateRouterAction } from '@/app/actions/device';
import { fetchIPhonesAction, fetchTabletsAction, fetchFeaturePhonesAction, fetchRoutersAction, fetchAreasAction, fetchAddressesAction } from '@/app/actions/device_fetch';

interface DataContextType {
    tablets: Tablet[];
    iPhones: IPhone[];
    featurePhones: FeaturePhone[];
    routers: Router[];
    employees: Employee[];
    areas: Area[];
    addresses: Address[];
    addTablet: (item: Omit<Tablet, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateTablet: (item: Tablet, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteTablet: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addIPhone: (item: Omit<IPhone, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateIPhone: (item: IPhone, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteIPhone: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addFeaturePhone: (item: Omit<FeaturePhone, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateFeaturePhone: (item: FeaturePhone, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteFeaturePhone: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addRouter: (item: Omit<Router, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateRouter: (item: Router, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteRouter: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addEmployee: (item: Omit<Employee, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateEmployee: (item: Employee, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteEmployee: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addArea: (item: Omit<Area, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateArea: (item: Area, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteArea: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    addAddress: (item: Omit<Address, 'id'> & { id?: string }, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    updateAddress: (item: Address, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteAddress: (id: string, skipLog?: boolean, skipToast?: boolean) => Promise<void>;
    deleteManyIPhones: (ids: string[]) => Promise<void>;
    deleteManyFeaturePhones: (ids: string[]) => Promise<void>;
    deleteManyTablets: (ids: string[]) => Promise<void>;
    deleteManyRouters: (ids: string[]) => Promise<void>;
    deleteManyEmployees: (ids: string[]) => Promise<void>;
    deleteManyAreas: (ids: string[]) => Promise<void>;
    deleteManyAddresses: (ids: string[]) => Promise<void>;
    fetchLogRange: (startDate: string, endDate: string) => Promise<void>;
    fetchLogMinDate: () => Promise<string | null>;
    logs: Log[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Data Mappers ---
// Helper to safely get string
const s = (val: any) => (val === null || val === undefined) ? '' : String(val);

const mapTabletFromDb = (d: any): Tablet => ({
    id: d.id,
    terminalCode: s(d.terminal_code),
    maker: s(d.maker),
    modelNumber: s(d.model_number),
    addressCode: s(d.address_code),
    costBearer: s(d.cost_bearer),
    address: s(d.address),
    notes: s(d.notes),
    history: s(d.lend_history),
    status: (d.status as DeviceStatus) || 'available',
    contractYears: s(d.contract_years),
    employeeCode: s(d.employee_code),
});

const mapTabletToDb = (t: Partial<Tablet>) => ({
    terminal_code: t.terminalCode,
    maker: t.maker,
    model_number: t.modelNumber,
    address_code: t.addressCode,
    cost_bearer: t.costBearer,
    address: t.address,
    notes: t.notes,
    lend_history: t.history,
    status: t.status,
    contract_years: t.contractYears,
    employee_code: t.employeeCode,
});

const mapIPhoneFromDb = (d: any): IPhone => ({
    id: d.id,
    carrier: s(d.carrier),
    phoneNumber: s(d.phone_number),
    managementNumber: s(d.management_number),
    employeeId: s(d.employee_code),

    addressCode: s(d.address_code),
    costBearer: s(d.cost_bearer),
    smartAddressId: s(d.smart_address_id),
    smartAddressPw: s(d.smart_address_pw),
    lendDate: s(d.lend_date),
    receiptDate: s(d.receipt_date),
    notes: s(d.notes),
    returnDate: s(d.return_date),
    modelName: s(d.model_name),
    status: (d.status as DeviceStatus) || 'available',
    contractYears: s(d.contract_years),
});

const mapIPhoneToDb = (t: Partial<IPhone>) => ({
    carrier: t.carrier,
    phone_number: t.phoneNumber,
    management_number: t.managementNumber,
    employee_code: t.employeeId,

    address_code: t.addressCode,
    cost_bearer: t.costBearer,
    smart_address_id: t.smartAddressId,
    smart_address_pw: t.smartAddressPw,
    lend_date: t.lendDate,
    receipt_date: t.receiptDate,
    notes: t.notes,
    return_date: t.returnDate,
    model_name: t.modelName,
    status: t.status,
    contract_years: t.contractYears,
});

const mapFeaturePhoneFromDb = (d: any): FeaturePhone => ({
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
    status: (d.status as DeviceStatus) || 'available',
    contractYears: s(d.contract_years),
});

const mapFeaturePhoneToDb = (t: Partial<FeaturePhone>) => ({
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
    status: t.status,
    contract_years: t.contractYears,
});

const mapRouterFromDb = (d: any): Router => ({
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
    status: (d.status as DeviceStatus) || 'available',
    contractStatus: s(d.contract_status),
    returnDate: '', // Missing in DB
    contractYears: s(d.contract_years),
    employeeCode: s(d.employee_code),
});

const mapRouterToDb = (t: Partial<Router>) => ({
    no: t.no,
    biller: t.biller,
    terminal_code: t.terminalCode,
    model_number: t.modelNumber,
    carrier: t.carrier,
    cost: t.cost ? Number(t.cost) : 0,
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
    status: t.status,
    employee_code: t.employeeCode,
});

const mapEmployeeFromDb = (d: any): Employee => ({
    id: d.id,
    code: s(d.employee_code),
    name: s(d.name),
    nameKana: s(d.name_kana),
    companyNo: '', // Missing
    departmentCode: '', // Missing
    email: s(d.email),

    gender: s(d.gender),
    birthDate: s(d.birthday),
    joinDate: s(d.join_date),
    age: Number(d.age_at_month_end) || 0,
    yearsOfService: Number(d.years_in_service) || 0,
    monthsHasuu: Number(d.months_in_service) || 0,
    areaCode: s(d.area_code),
    addressCode: s(d.address_code),
    role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    profileImage: typeof window !== 'undefined' ? (localStorage.getItem(`profile_image_${d.id}`) || '') : '',
    authId: s(d.auth_id),
});

const mapEmployeeToDb = (t: Partial<Employee> & { auth_id?: string }) => ({
    employee_code: t.code,
    auth_id: t.auth_id,
    // password: t.password, // Password is NOT stored in DB, strictly used for Auth User creation
    name: t.name,
    name_kana: t.nameKana,
    email: t.email,
    gender: t.gender,
    birthday: t.birthDate,
    join_date: t.joinDate,
    age_at_month_end: t.age ? Number(t.age) : 0,
    years_in_service: t.yearsOfService ? Number(t.yearsOfService) : 0,
    months_in_service: t.monthsHasuu ? Number(t.monthsHasuu) : 0,
    area_code: t.areaCode,
    address_code: t.addressCode,
    authority: t.role,
});

const mapAreaFromDb = (d: any): Area => ({
    id: d.area_code, // Use code as ID if PK
    areaCode: s(d.area_code),
    areaName: s(d.area_name),
});

const mapAreaToDb = (t: Partial<Area>) => ({
    area_code: t.areaCode,
    area_name: t.areaName,
});

const mapAddressFromDb = (d: any): Address => ({
    id: d.id,
    no: s(d.no),
    addressCode: s(d.address_code),
    officeName: s(d.office_name),
    tel: s(d.tel),
    fax: s(d.fax),
    type: s(d.category),
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
});

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

// Local mapLogFromDb removed in favor of logService.mapLogFromDb

const TARGET_MAP: Record<string, TargetType> = {
    tablets: 'tablet',
    iphones: 'iphone',
    featurephones: 'feature_phone',
    routers: 'router',
    employees: 'employee',
    areas: 'area',
    addresses: 'address',
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const supabase = createClientComponentClient();
    const [tablets, setTablets] = useState<Tablet[]>([]);
    const [iPhones, setIPhones] = useState<IPhone[]>([]);
    const [featurePhones, setFeaturePhones] = useState<FeaturePhone[]>([]);
    const [routers, setRouters] = useState<Router[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const { user } = useAuth();
    const { showToast, dismissToast } = useToast();

    const fetchData = useCallback(async () => {
        const toastId = showToast('データ読み込み中...', 'loading', undefined, 0);
        try {
            // Use Server Actions to fetch data (bypassing RLS issues for imported users)
            const [
                iPhoneData,
                tabletData,
                featurePhoneData,
                routerData,
                employeeData,
                areaData,
                addressData
            ] = await Promise.all([
                fetchIPhonesAction(),
                fetchTabletsAction(),
                fetchFeaturePhonesAction(),
                fetchRoutersAction(),
                fetchEmployeesAction(),
                fetchAreasAction(),
                fetchAddressesAction(),
            ]);

            // Default fetch: Current week's logs from audit_logs
            const { start, end } = getWeekRange(new Date());
            const { data: logData } = await supabase.from('audit_logs')
                .select('*')
                .gte('occurred_at', start.toISOString())
                .lte('occurred_at', end.toISOString())
                .order('occurred_at', { ascending: false });

            if (tabletData) setTablets(tabletData.map(mapTabletFromDb));
            if (iPhoneData) setIPhones(iPhoneData.map(mapIPhoneFromDb));
            if (featurePhoneData) setFeaturePhones(featurePhoneData.map(mapFeaturePhoneFromDb));
            if (routerData) setRouters(routerData.map(mapRouterFromDb));
            if (employeeData) setEmployees(employeeData.map(mapEmployeeFromDb));
            if (areaData) setAreas(areaData.map(mapAreaFromDb));
            if (addressData) setAddresses(addressData.map(mapAddressFromDb));
            if (logData) setLogs(logData.map(logService.mapLogFromDb));

        } catch (error) {
            console.error('Failed to fetch data:', error);
            showToast('データ読み込みに失敗しました', 'error');
        } finally {
            dismissToast(toastId);
        }
    }, [supabase, showToast, useToast]); // useToast added to dep if needed, but showToast is enough if stable

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, fetchData]);

    // Generic CRUD helpers
    const addItem = useCallback(async <T,>(
        table: string,
        item: any,
        mapperToDb: (i: any) => any,
        mapperFromDb: (i: any) => T,
        setState: React.Dispatch<React.SetStateAction<T[]>>,
        skipLog: boolean = false,
        skipToast: boolean = false
    ) => {
        try {
            const dbItem = mapperToDb(item);
            const { data, error } = await supabase.from(table).insert(dbItem).select().single();
            if (error) throw error;

            const newItem = mapperFromDb(data);
            setState(prev => [...prev, newItem]);

            if (!skipToast) {
                showToast('登録しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to add item to ${table}:`, JSON.stringify(error, null, 2));
            if (!skipToast) {
                showToast('登録に失敗しました', 'error', error?.message || '不明なエラー');
            }
            throw error;
        }
    }, [showToast]);

    const updateItem = useCallback(async <T extends { id: string }>(
        table: string,
        item: T,
        mapperToDb: (i: T) => any,
        currentData: T[],
        setState: React.Dispatch<React.SetStateAction<T[]>>,
        skipLog: boolean = false,
        skipToast: boolean = false
    ) => {
        try {
            const dbItem = mapperToDb(item);
            const { error } = await supabase.from(table).update(dbItem).eq('id', item.id);
            if (error) throw error;

            setState(prev => prev.map(p => p.id === item.id ? item : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to update item in ${table}:`, error);
            const errorMessage = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', errorMessage);
            }
            throw error;
        }
    }, [showToast]);

    const deleteItem = useCallback(async <T extends { id: string }>(table: string, id: string, setState: React.Dispatch<React.SetStateAction<T[]>>, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            setState(prev => prev.filter(p => p.id !== id));

            // Removed to separate Audit/Operation logs. DB Triggers handle 'logs' (Operation Log).
            /*
            if (!skipLog) {
                const targetType = TARGET_MAP[table] || 'unknown';
                await logger.info({
                    action: 'DELETE',
                    targetType,
                    targetId: id,
                    message: `${table} から ID: ${id} を削除しました`,
                    actor: user ? { employeeCode: user.code, name: user.name, authId: user.authId } : undefined
                });
            }
            */

            if (!skipToast) {
                showToast('削除しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to delete item from ${table}:`, error);
            if (!skipToast) {
                showToast('削除に失敗しました', 'error', error.message);
            }
            throw error;
        }
    }, [showToast, user, supabase]); // Added user and supabase to dependencies

    const deleteItems = useCallback(async <T extends { id: string }>(table: string, ids: string[], setState: React.Dispatch<React.SetStateAction<T[]>>, isArea: boolean = false, skipLog: boolean = false) => {
        try {
            if (table === 'employees') {
                // Special handling for Employee bulk delete to sync Auth User deletion
                if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
                    await deleteManyEmployeesBySetupAdmin(ids);
                } else {
                    await deleteManyEmployeesAction(ids);
                }
            } else {
                // Default generic delete
                const pkField = isArea ? 'area_code' : 'id';
                const { error } = await supabase.from(table).delete().in(pkField, ids);
                if (error) throw error;
            }

            setState(prev => prev.filter(p => !ids.includes(p.id)));

            // Removed to separate Audit/Operation logs. DB Triggers handle 'logs' (Operation Log).
            /*
            if (!skipLog) {
                const targetType = TARGET_MAP[table] || 'unknown';
                await logger.info({
                    action: 'DELETE',
                    targetType,
                    message: `${table} から ${ids.length} 件を一括削除しました`,
                    metadata: { deletedIds: ids },
                    actor: user ? { employeeCode: user.code, name: user.name, authId: user.authId } : undefined
                });
            }
            */

            showToast(`${ids.length}件、削除しました`, 'success');
        } catch (error: any) {
            console.error(`Failed to delete items from ${table}:`, error);
            showToast('削除に失敗しました', 'error', error.message);
            throw error;
        }
    }, [showToast, user, supabase]); // Added user and supabase to dependencies

    // Specific implementations
    const addTablet = (item: Omit<Tablet, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('tablets', item, mapTabletToDb, mapTabletFromDb, setTablets, skipLog, skipToast);

    const updateTablet = async (item: Tablet, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Use Server Action for Tablet updates to handle usage history
            const { id, ...data } = item;
            const result = await updateTabletAction(id, data);

            const newItem = mapTabletFromDb(result);
            setTablets(prev => prev.map(p => p.id === item.id ? newItem : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error('Failed to update Tablet:', error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };
    const deleteTablet = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('tablets', id, setTablets, skipLog, skipToast);

    const addIPhone = (item: Omit<IPhone, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('iphones', item, mapIPhoneToDb, mapIPhoneFromDb, setIPhones, skipLog, skipToast);
    const updateIPhone = async (item: IPhone, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Use Server Action for IPhone updates to handle history tracking
            const { id, ...data } = item;

            const result = await updateIPhoneAction(id, data);

            // Map the result (raw DB data) back to IPhone type
            const newItem = mapIPhoneFromDb(result);
            setIPhones(prev => prev.map(p => p.id === item.id ? newItem : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error('Failed to update iPhone:', error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };
    const deleteIPhone = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('iphones', id, setIPhones, skipLog, skipToast);

    const addFeaturePhone = (item: Omit<FeaturePhone, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('featurephones', item, mapFeaturePhoneToDb, mapFeaturePhoneFromDb, setFeaturePhones, skipLog, skipToast);
    const updateFeaturePhone = async (item: FeaturePhone, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Use Server Action for FeaturePhone updates to handle usage history
            const { id, ...data } = item;
            const result = await updateFeaturePhoneAction(id, data);

            const newItem = mapFeaturePhoneFromDb(result);
            setFeaturePhones(prev => prev.map(p => p.id === item.id ? newItem : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error('Failed to update FeaturePhone:', error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };
    const deleteFeaturePhone = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('featurephones', id, setFeaturePhones, skipLog, skipToast);

    const addRouter = (item: Omit<Router, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('routers', item, mapRouterToDb, mapRouterFromDb, setRouters, skipLog, skipToast);
    const updateRouter = async (item: Router, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Use Server Action for Router updates to handle usage history
            const { id, ...data } = item;
            const result = await updateRouterAction(id, data);

            const newItem = mapRouterFromDb(result);
            setRouters(prev => prev.map(p => p.id === item.id ? newItem : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error('Failed to update Router:', error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };
    const deleteRouter = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('routers', id, setRouters, skipLog, skipToast);


    const addEmployee = async (item: Omit<Employee, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // 1. Create Auth User via API
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Auth Registration Failed (${response.status}):`, errorText);
                try {
                    const errRes = JSON.parse(errorText);
                    console.error('Parsed Error Details:', errRes);
                } catch (e) {
                    // Not JSON
                }
                if (!skipToast) showToast('Authユーザー作成に失敗しました', 'error');
                throw new Error(`Auth Registration Failed: ${errorText}`);
            } else {
                const authResult = await response.json();
                if (authResult.userId) {
                    (item as any).auth_id = authResult.userId;
                    // Security event: Auth User creation remains in Audit Logs
                    await logger.info({
                        action: 'CREATE',
                        targetType: 'auth',
                        message: `管理者特権による認証ユーザー作成: ${authResult.userId} (社員CD: ${item.code})`,
                        actor: user ? { employeeCode: user.code, name: user.name } : undefined
                    });
                }
            }
        } catch (e) {
            console.error('Registration API Error:', e);
        }

        // 2. Insert into DB (now includes auth_id if successful)
        if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
            try {
                const result = await createEmployeeBySetupAdmin(item);
                const newItem = mapEmployeeFromDb(result);
                setEmployees(prev => [...prev, newItem]);
                if (!skipToast) showToast('登録しました (Setup)', 'success');
                return;
            } catch (error: any) {
                console.error('Setup Admin DB Insert Failed:', error);
                if (!skipToast) showToast('DB登録に失敗しました', 'error', error.message);
                throw error;
            }
        }

        return (async () => {
            try {
                // Use Server Action to bypass RLS
                const result = await createEmployeeAction(item);

                const newItem = mapEmployeeFromDb(result);
                setEmployees(prev => [...prev, newItem]);

                if (!skipToast) {
                    showToast('登録しました', 'success');
                }
            } catch (error: any) {
                console.error(`Failed to add employee:`, error);
                if (!skipToast) {
                    showToast('登録に失敗しました', 'error', error.message || '不明なエラー');
                }
                throw error;
            }
        })();
    };
    const updateEmployee = async (item: Employee, skipLog: boolean = false, skipToast: boolean = false) => {
        // Intercept to save profile image to localStorage
        if (item.profileImage) {
            try {
                localStorage.setItem(`profile_image_${item.id}`, item.profileImage);
            } catch (e) {
                console.error('Failed to save profile image to localStorage', e);
            }
        }

        if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
            try {
                await updateEmployeeBySetupAdmin(item);
                setEmployees(prev => prev.map(p => p.id === item.id ? item : p));
                if (!skipToast) showToast('更新しました (Setup)', 'success');
                return;
            } catch (error: any) {
                console.error('Setup Admin DB Update Failed:', error);
                if (!skipToast) showToast('更新に失敗しました', 'error', error.message);
                throw error;
            }
        }

        // 1. Auth Sync (similar to addEmployee)
        try {
            // Find current employee to check for changes
            const currentEmployee = employees.find(e => e.id === item.id);
            const isEmailChanged = currentEmployee && currentEmployee.email !== item.email;

            // Only sync if important fields changed or if we want to ensure consistency
            // We always sync to ensure Auth DB is up to date (e.g. password, name, role) or if email changed

            // Note: We need to send authId if available to ensure we update the correct user
            // If item.authId is missing, maybe we can get it from currentEmployee?
            const authIds = item.authId || (item as any).auth_id || currentEmployee?.authId || (currentEmployee as any)?.auth_id;
            console.log(`[DEBUG] ID Check: ItemID=${item.id}, AuthID=${authIds}, CurrentEmpAuth=${currentEmployee?.authId}`);

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...item,
                    authId: authIds // Ensure authId is passed for update
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`Auth Update Warning (${response.status}):`, errorText);
                // Suppress toast since DB update is primary and will trigger sync
                // showToast('Auth情報の更新に失敗しました', 'error');
            } else {
                const authResult = await response.json();
                // If we got a userId back (and we didn't have one or it changed?), update it
                if (authResult.userId && item.authId !== authResult.userId) {
                    (item as any).authId = authResult.userId;
                    (item as any).auth_id = authResult.userId; // For DB mapper
                }
            }

            // 2. DB Update (Use Server Action to bypass RLS/Email issues)
            await updateEmployeeAction(item.id, item);

            // Update local state manually since we bypassed updateItem
            setEmployees(prev => prev.map(p => p.id === item.id ? { ...p, ...item } : p));
            if (!skipToast) showToast('更新しました', 'success');

            // 3. Logging (Explicitly for Employee Update)
            // Removed to separate Audit/Operation logs. DB Triggers handle 'logs' (Operation Log).
            /*
            if (!skipLog) {
                let message = `社員情報を更新しました: ${item.name}`;
                if (isEmailChanged) {
                    message += ` (メールアドレス変更: ${currentEmployee?.email} -> ${item.email})`;
                }

                await logger.info({
                    action: 'UPDATE',
                    targetType: 'employee',
                    targetId: item.id,
                    message: message,
                    actor: user ? { employeeCode: user.code, name: user.name } : undefined,
                    metadata: {
                        changedFields: isEmailChanged ? ['email'] : [],
                        oldEmail: currentEmployee?.email,
                        newEmail: item.email
                    }
                });
            }
            */

        } catch (error: any) {
            console.error('Update Employee Failed:', error);
            if (!skipToast) showToast('更新に失敗しました', 'error', error.message);
            throw error;
        }
    };
    const deleteEmployee = (id: string, skipLog: boolean = false, skipToast: boolean = false) => {
        if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
            return (async () => {
                try {
                    await deleteEmployeeBySetupAdmin(id);
                    setEmployees(prev => prev.filter(p => p.id !== id));
                    if (!skipToast) showToast('削除しました (Setup)', 'success');
                } catch (error: any) {
                    console.error('Setup Admin DB Delete Failed:', error);
                    if (!skipToast) showToast('削除に失敗しました', 'error', error.message);
                    throw error;
                }
            })();
        }
        // Use Server Action for Employee deletion to also remove Auth User
        return (async () => {
            try {
                await deleteEmployeeAction(id);
                setEmployees(prev => prev.filter(p => p.id !== id));

                if (!skipLog) {
                    await logger.info({
                        action: 'DELETE',
                        targetType: 'employee',
                        targetId: id,
                        message: `employees から ID: ${id} を削除しました (Auth User含む)`,
                        actor: user ? { employeeCode: user.code, name: user.name, authId: user.authId } : undefined
                    });
                }

                if (!skipToast) showToast('削除しました', 'success');
            } catch (error: any) {
                console.error('Delete Employee Failed:', error);
                if (!skipToast) showToast('削除に失敗しました', 'error', error.message);
                throw error;
            }
        })();
    };

    const addArea = (item: Omit<Area, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('areas', item, mapAreaToDb, mapAreaFromDb, setAreas, skipLog, skipToast);
    const updateArea = async (item: Area, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            const dbItem = mapAreaToDb(item);
            // DB PK is area_code. TS Area.id matches areaCode.
            const { error } = await supabase.from('areas').update(dbItem).eq('area_code', item.id);
            if (error) throw error;

            setAreas(prev => prev.map(p => p.id === item.id ? item : p));

            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to update item in areas:`, error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };
    // Areas delete handling - assuming area_code is unique and we use it as ID for deletion if id matches areaCode
    const deleteArea = async (id: string, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Note: DB PK is area_code. TS Area.id is areaCode.
            const { error } = await supabase.from('areas').delete().eq('area_code', id);
            if (error) throw error;
            setAreas(prev => prev.filter(p => p.id !== id));
            if (!skipToast) {
                showToast('削除しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to delete item from areas:`, error);
            if (!skipToast) {
                showToast('削除に失敗しました', 'error', error.message);
            }
            throw error;
        }
    };

    const addAddress = (item: Omit<Address, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('addresses', item, mapAddressToDb, mapAddressFromDb, setAddresses, skipLog, skipToast);
    const updateAddress = (item: Address, skipLog: boolean = false, skipToast: boolean = false) => updateItem('addresses', item, mapAddressToDb, addresses, setAddresses, skipLog, skipToast);
    const deleteAddress = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('addresses', id, setAddresses, skipLog, skipToast);

    const deleteManyIPhones = (ids: string[]) => deleteItems('iphones', ids, setIPhones);
    const deleteManyFeaturePhones = (ids: string[]) => deleteItems('featurephones', ids, setFeaturePhones);
    const deleteManyTablets = (ids: string[]) => deleteItems('tablets', ids, setTablets);
    const deleteManyRouters = (ids: string[]) => deleteItems('routers', ids, setRouters);
    const deleteManyEmployees = (ids: string[]) => {
        if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
            return (async () => {
                try {
                    await deleteManyEmployeesBySetupAdmin(ids);
                    setEmployees(prev => prev.filter(p => !ids.includes(p.id)));
                    showToast(`${ids.length}件、削除しました (Setup)`, 'success');
                } catch (error: any) {
                    console.error('Setup Admin DB Bulk Delete Failed:', error);
                    showToast('削除に失敗しました', 'error', error.message);
                    throw error;
                }
            })();
        }
        return deleteItems('employees', ids, setEmployees);
    };
    const deleteManyAreas = (ids: string[]) => deleteItems('areas', ids, setAreas, true);
    const deleteManyAddresses = (ids: string[]) => deleteItems('addresses', ids, setAddresses);

    const fetchLogRange = useCallback(async (startDate: string, endDate: string) => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .gte('occurred_at', startDate)
                .lte('occurred_at', endDate)
                .order('occurred_at', { ascending: false });

            if (error) throw error;
            if (data) setLogs(data.map(logService.mapLogFromDb));
        } catch (error: any) {
            console.error('Failed to fetch log range:', error.message || JSON.stringify(error));
        }
    }, []);

    const fetchLogMinDate = useCallback(async (): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('occurred_at')
                .order('occurred_at', { ascending: true })
                .limit(1)
                .single();

            if (error) return null; // Likely no logs
            return data?.occurred_at || null;
        } catch (error) {
            console.error('Failed to fetch min log date:', error);
            return null;
        }
    }, []);

    return (
        <DataContext.Provider value={{
            tablets, iPhones, featurePhones, routers, employees, areas, addresses,
            addTablet, updateTablet, deleteTablet,
            addIPhone, updateIPhone, deleteIPhone,
            addFeaturePhone, updateFeaturePhone, deleteFeaturePhone,
            addRouter, updateRouter, deleteRouter,
            addEmployee, updateEmployee, deleteEmployee,
            addArea, updateArea, deleteArea,
            addAddress, updateAddress, deleteAddress,
            deleteManyIPhones, deleteManyFeaturePhones, deleteManyTablets, deleteManyRouters,
            deleteManyEmployees, deleteManyAreas, deleteManyAddresses,
            fetchLogRange,
            fetchLogMinDate,
            logs
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
