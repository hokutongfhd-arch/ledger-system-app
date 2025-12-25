'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Tablet, IPhone, FeaturePhone, Router, Employee, Area, Address, Log, DeviceStatus } from '../../lib/types';
import { useAuth } from './AuthContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getWeekRange } from '../../lib/utils/dateHelpers';
import { logger, LogActionType, TargetType } from '../../lib/logger';
import { useToast } from './ToastContext';
import { logService } from '../logs/log.service';

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
    addLog: (endpoint: string, action: 'add' | 'update' | 'delete' | 'import', details: string) => Promise<void>;
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
    officeCode: s(d.office_code),
    addressCode: s(d.address_code),
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
    office_code: t.officeCode,
    address_code: t.addressCode,
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
    smartAddressId: s(d.smart_address_id),
    smartAddressPw: s(d.smart_address_pw),
    lendDate: s(d.lend_date),
    receiptDate: s(d.receipt_date),
    notes: s(d.notes),
    returnDate: s(d.return_date),
    modelName: s(d.model_name),
    status: '貸出中', // Placeholder as 'status' column is missing in provided DB schema
    contractYears: s(d.contract_years),
});

const mapIPhoneToDb = (t: Partial<IPhone>) => ({
    carrier: t.carrier,
    phone_number: t.phoneNumber,
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
    status: d.employee_code ? '貸出中' : '貸出準備中',
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
    employee_code: t.employeeCode,
});

const mapEmployeeFromDb = (d: any): Employee => ({
    id: d.id,
    code: s(d.employee_code),
    name: s(d.name),
    nameKana: s(d.name_kana),
    companyNo: '', // Missing
    departmentCode: '', // Missing
    email: '', // Missing
    password: s(d.password),
    gender: s(d.gender),
    birthDate: s(d.birthday),
    joinDate: s(d.join_date),
    age: Number(d.age_at_month_end) || 0,
    yearsOfService: Number(d.years_in_service) || 0,
    monthsHasuu: Number(d.months_in_service) || 0,
    employeeType: s(d.employee_class),
    salaryType: s(d.salary_class),
    costType: s(d.cost_class),
    areaCode: s(d.area_code),
    addressCode: s(d.address_code),
    roleTitle: s(d.position),
    jobType: s(d.job_type),
    role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    profileImage: localStorage.getItem(`profile_image_${d.id}`) || '',
});

const mapEmployeeToDb = (t: Partial<Employee> & { auth_id?: string }) => ({
    employee_code: t.code,
    auth_id: t.auth_id,
    password: t.password,
    name: t.name,
    name_kana: t.nameKana,
    gender: t.gender,
    birthday: t.birthDate,
    join_date: t.joinDate,
    age_at_month_end: t.age ? Number(t.age) : 0,
    years_in_service: t.yearsOfService ? Number(t.yearsOfService) : 0,
    months_in_service: t.monthsHasuu ? Number(t.monthsHasuu) : 0,
    employee_class: t.employeeType,
    salary_class: t.salaryType,
    cost_class: t.costType,
    area_code: t.areaCode,
    address_code: t.addressCode,
    position: t.roleTitle,
    job_type: t.jobType,
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
    const { showToast } = useToast();

    const fetchData = async () => {
        try {
            const [t, i, f, r, e, a, ad] = await Promise.all([
                supabase.from('tablets').select('*'),
                supabase.from('iphones').select('*'),
                supabase.from('featurephones').select('*'),
                supabase.from('routers').select('*'),
                supabase.from('employees').select('*'),
                supabase.from('areas').select('*'),
                supabase.from('addresses').select('*'),
            ]);

            // Default fetch: Current week's logs from audit_logs
            const { start, end } = getWeekRange(new Date());
            const { data: logData } = await supabase.from('audit_logs')
                .select('*')
                .gte('occurred_at', start.toISOString())
                .lte('occurred_at', end.toISOString())
                .order('occurred_at', { ascending: false });

            if (t.data) setTablets(t.data.map(mapTabletFromDb));
            if (i.data) setIPhones(i.data.map(mapIPhoneFromDb));
            if (f.data) setFeaturePhones(f.data.map(mapFeaturePhoneFromDb));
            if (r.data) setRouters(r.data.map(mapRouterFromDb));
            if (e.data) setEmployees(e.data.map(mapEmployeeFromDb));
            if (a.data) setAreas(a.data.map(mapAreaFromDb));
            if (ad.data) setAddresses(ad.data.map(mapAddressFromDb));
            if (logData) setLogs(logData.map(logService.mapLogFromDb));

        } catch (error) {
            console.error('Failed to fetch data from Supabase:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const logAction = useCallback(async (endpoint: string, action: 'add' | 'update' | 'delete' | 'import', details: string) => {
        try {
            const targetType = TARGET_MAP[endpoint.toLowerCase()] || 'unknown';

            let actionType: LogActionType = 'UPDATE';
            if (action === 'add') actionType = 'CREATE';
            if (action === 'delete') actionType = 'DELETE';
            if (action === 'import') actionType = 'IMPORT';

            await logger.info({
                action: actionType,
                targetType: targetType,
                message: details,
                actor: user ? { employeeCode: user.code, name: user.name } : undefined,
                metadata: { details }
            });

            // Optimistic update for UI
            const tempLog: Log = {
                id: 'temp-' + Date.now(),
                timestamp: new Date().toISOString(),
                user: user?.name || 'Unknown',
                actorName: user?.name || 'Unknown',
                actorEmployeeCode: user?.code || '',
                target: TARGET_MAP[endpoint.toLowerCase()] ? logService.mapLogFromDb({ target_type: TARGET_MAP[endpoint.toLowerCase()] }).target : endpoint,
                targetRaw: endpoint,
                targetId: '',
                action,
                actionRaw: actionType,
                result: 'success',
                metadata: { details },
                ipAddress: '',
                details: details,
            };
            setLogs(prev => [tempLog, ...prev]);

        } catch (error: any) {
            console.error('Failed to log action:', error);
        }
    }, [user]);

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

            if (!skipLog) {
                await logAction(table, 'add', '新規登録');
            }
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
    }, [logAction, showToast]);

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
            const oldItem = currentData.find(d => d.id === item.id);
            const changedColumns = oldItem
                ? Object.keys(item).filter(key => item[key as keyof T] !== oldItem[key as keyof T] && key !== 'id')
                : [];

            const dbItem = mapperToDb(item);
            const { error } = await supabase.from(table).update(dbItem).eq('id', item.id);
            if (error) throw error;

            setState(prev => prev.map(p => p.id === item.id ? item : p));

            if (!skipLog && changedColumns.length > 0) {
                await logAction(table, 'update', `修正: ${changedColumns.join(', ')}`);
            }
            if (!skipToast) {
                showToast('更新しました', 'success');
            }
        } catch (error: any) {
            console.error(`Failed to update item in ${table}:`, error);
            if (!skipToast) {
                showToast('更新に失敗しました', 'error', error.message);
            }
            throw error;
        }
    }, [logAction, showToast]);

    const deleteItem = useCallback(async <T extends { id: string }>(table: string, id: string, setState: React.Dispatch<React.SetStateAction<T[]>>, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;

            setState(prev => prev.filter(p => p.id !== id));
            if (!skipLog) {
                await logAction(table, 'delete', '削除');
            }
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
    }, [logAction, showToast]);

    // Specific implementations
    const addTablet = (item: Omit<Tablet, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('tablets', item, mapTabletToDb, mapTabletFromDb, setTablets, skipLog, skipToast);
    const updateTablet = (item: Tablet, skipLog: boolean = false, skipToast: boolean = false) => updateItem('tablets', item, mapTabletToDb, tablets, setTablets, skipLog, skipToast);
    const deleteTablet = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('tablets', id, setTablets, skipLog, skipToast);

    const addIPhone = (item: Omit<IPhone, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('iphones', item, mapIPhoneToDb, mapIPhoneFromDb, setIPhones, skipLog, skipToast);
    const updateIPhone = (item: IPhone, skipLog: boolean = false, skipToast: boolean = false) => updateItem('iphones', item, mapIPhoneToDb, iPhones, setIPhones, skipLog, skipToast);
    const deleteIPhone = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('iphones', id, setIPhones, skipLog, skipToast);

    const addFeaturePhone = (item: Omit<FeaturePhone, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('featurephones', item, mapFeaturePhoneToDb, mapFeaturePhoneFromDb, setFeaturePhones, skipLog, skipToast);
    const updateFeaturePhone = (item: FeaturePhone, skipLog: boolean = false, skipToast: boolean = false) => updateItem('featurephones', item, mapFeaturePhoneToDb, featurePhones, setFeaturePhones, skipLog, skipToast);
    const deleteFeaturePhone = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('featurephones', id, setFeaturePhones, skipLog, skipToast);

    const addRouter = (item: Omit<Router, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('routers', item, mapRouterToDb, mapRouterFromDb, setRouters, skipLog, skipToast);
    const updateRouter = (item: Router, skipLog: boolean = false, skipToast: boolean = false) => updateItem('routers', item, mapRouterToDb, routers, setRouters, skipLog, skipToast);
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
                const errRes = await response.json();
                console.error('Auth Registration Failed:', errRes);
                if (!skipToast) showToast('Authユーザー作成に失敗しましたが、DB登録を試みます', 'warning');
            } else {
                const authResult = await response.json();
                if (authResult.userId) {
                    (item as any).auth_id = authResult.userId;
                    await logAction('employees', 'add', `Authユーザー作成: ${authResult.userId}`);
                }
            }
        } catch (e) {
            console.error('Registration API Error:', e);
        }

        // 2. Insert into DB (now includes auth_id if successful)
        return addItem('employees', item, mapEmployeeToDb, mapEmployeeFromDb, setEmployees, skipLog, skipToast);
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
        return updateItem('employees', item, mapEmployeeToDb, employees, setEmployees, skipLog, skipToast);
    };
    const deleteEmployee = (id: string, skipLog: boolean = false, skipToast: boolean = false) => deleteItem('employees', id, setEmployees, skipLog, skipToast);

    const addArea = (item: Omit<Area, 'id'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false) => addItem('areas', item, mapAreaToDb, mapAreaFromDb, setAreas, skipLog, skipToast);
    const updateArea = (item: Area, skipLog: boolean = false, skipToast: boolean = false) => updateItem('areas', item, mapAreaToDb, areas, setAreas, skipLog, skipToast);

    // Areas delete handling - assuming area_code is unique and we use it as ID for deletion if id matches areaCode
    const deleteArea = async (id: string, skipLog: boolean = false, skipToast: boolean = false) => {
        try {
            // Note: DB PK is area_code. TS Area.id is areaCode.
            const { error } = await supabase.from('areas').delete().eq('area_code', id);
            if (error) throw error;
            setAreas(prev => prev.filter(p => p.id !== id));
            if (!skipLog) {
                await logAction('areas', 'delete', '削除');
            }
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
            addLog: logAction,
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
