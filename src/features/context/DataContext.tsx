'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { Tablet, IPhone, FeaturePhone, Router, Employee, Area, Address, Log, DeviceStatus } from '../../lib/types';
import { useAuth } from './AuthContext';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getWeekRange, calculateAge, calculateServicePeriod } from '../../lib/utils/dateHelpers';
import { logger, LogActionType, TargetType } from '../../lib/logger';
import { useToast } from './ToastContext';
import { useConfirm } from '../../hooks/useConfirm';
import { logService } from '../logs/log.service';
import { createEmployeeAction, fetchEmployeesAction, deleteEmployeeAction, deleteManyEmployeesAction, updateEmployeeAction } from '@/app/actions/employee';
import {
    updateIPhoneAction, updateFeaturePhoneAction, updateTabletAction, updateRouterAction,
    createIPhoneAction, deleteIPhoneAction, deleteManyIPhonesAction,
    createFeaturePhoneAction, deleteFeaturePhoneAction, deleteManyFeaturePhonesAction,
    createTabletAction, deleteTabletAction, deleteManyTabletsAction,
    createRouterAction, deleteRouterAction, deleteManyRoutersAction
} from '@/app/actions/device';
import { fetchIPhonesAction, fetchTabletsAction, fetchFeaturePhonesAction, fetchRoutersAction, fetchAreasAction, fetchAddressesAction } from '@/app/actions/device_fetch';
import {
    createAreaAction, updateAreaAction, deleteAreaAction, deleteManyAreasAction,
    createAddressAction, updateAddressAction, deleteAddressAction, deleteManyAddressesAction
} from '@/app/actions/master';
import { deleteManyEmployeesBySetupAdmin } from '@/app/actions/employee_setup';
import { fetchAuditLogsAction, fetchLogMinDateAction } from '@/app/actions/audit';
import { getSyncMetadataAction, type SyncMetadata } from '@/app/actions/sync';

interface DataContextType {
    tablets: Tablet[];
    iPhones: IPhone[];
    featurePhones: FeaturePhone[];
    routers: Router[];
    employees: Employee[];
    areas: Area[];
    addresses: Address[];
    employeeMap: Map<string, Employee>;
    addressMap: Map<string, Address>;
    fetchIPhones: () => Promise<void>;
    fetchTablets: () => Promise<void>;
    fetchFeaturePhones: () => Promise<void>;
    fetchRouters: () => Promise<void>;
    fetchEmployees: () => Promise<void>;
    fetchAddresses: () => Promise<void>;
    fetchAreas: () => Promise<void>;
    addTablet: (item: Omit<Tablet, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateTablet: (item: Tablet, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteTablet: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addIPhone: (item: Omit<IPhone, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateIPhone: (item: IPhone, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteIPhone: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addFeaturePhone: (item: Omit<FeaturePhone, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateFeaturePhone: (item: FeaturePhone, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteFeaturePhone: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addRouter: (item: Omit<Router, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateRouter: (item: Router, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteRouter: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addEmployee: (item: Omit<Employee, 'id' | 'version' | 'updatedAt'> & { id?: string, password?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateEmployee: (item: Employee, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteEmployee: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addArea: (item: Omit<Area, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateArea: (item: Area, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteArea: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
    addAddress: (item: Omit<Address, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    updateAddress: (item: Address, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<void>;
    deleteAddress: (id: string, version: number, skipLog?: boolean, skipToast?: boolean, skipDialog?: boolean) => Promise<any>;
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
    handleCRUDError: (table: string, error: any, skipToast?: boolean, skipDialog?: boolean, operationName?: string, itemIdentifier?: string) => Promise<void>;
    setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>;
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
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
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
    version: t.version,
});

const mapIPhoneFromDb = (d: any): IPhone => ({
    id: d.id,
    carrier: s(d.carrier),
    phoneNumber: s(d.phone_number),
    managementNumber: s(d.management_number),
    employeeCode: s(d.employee_code),
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
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
});

const mapIPhoneToDb = (t: Partial<IPhone>) => ({
    carrier: t.carrier,
    phone_number: t.phoneNumber,
    management_number: t.managementNumber,
    employee_code: t.employeeCode,
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
    version: t.version,
});

const mapFeaturePhoneFromDb = (d: any): FeaturePhone => ({
    id: d.id,
    carrier: s(d.carrier),
    phoneNumber: s(d.phone_number),
    managementNumber: s(d.management_number),
    employeeCode: s(d.employee_code),
    addressCode: s(d.address_code),
    costCompany: s(d.cost_company),
    lendDate: s(d.lend_date),
    receiptDate: s(d.receipt_date),
    notes: s(d.notes),
    returnDate: s(d.return_date),
    modelName: s(d.model_name),
    status: (d.status as DeviceStatus) || 'available',
    contractYears: s(d.contract_years),
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
});

const mapFeaturePhoneToDb = (t: Partial<FeaturePhone>) => ({
    carrier: t.carrier,
    phone_number: t.phoneNumber,
    management_number: t.managementNumber,
    employee_code: t.employeeCode,
    address_code: t.addressCode,
    cost_company: t.costCompany,
    lend_date: t.lendDate,
    receipt_date: t.receiptDate,
    notes: t.notes,
    return_date: t.returnDate,
    model_name: t.modelName,
    status: t.status,
    contract_years: t.contractYears,
    version: t.version,
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
    costBearer: s(d.cost_bearer),
    actualLenderName: s(d.actual_lender_name),
    lendingHistory: s(d.lend_history),
    notes: s(d.notes),
    status: (d.status as DeviceStatus) || 'available',
    contractStatus: s(d.contract_status),
    returnDate: '', // Missing in DB
    contractYears: s(d.contract_years),
    employeeCode: s(d.employee_code),
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
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
    cost_bearer: t.costBearer,
    actual_lender_name: t.actualLenderName,
    lend_history: t.lendingHistory,
    notes: t.notes,
    contract_status: t.contractStatus,
    contract_years: t.contractYears,
    status: t.status,
    employee_code: t.employeeCode,
    version: t.version,
});

const mapEmployeeFromDb = (d: any): Employee => {
    const rawBirthDate = s(d.birthday);
    const rawJoinDate = s(d.join_date);

    const computedAge = rawBirthDate ? calculateAge(rawBirthDate) : (Number(d.age_at_month_end) || 0);
    const computedService = rawJoinDate ? calculateServicePeriod(rawJoinDate) : { years: Number(d.years_in_service) || 0, months: Number(d.months_in_service) || 0 };

    return {
        id: d.id,
        code: s(d.employee_code),
        name: s(d.name),
        nameKana: s(d.name_kana),
        companyNo: '', // Missing
        departmentCode: '', // Missing
        email: s(d.email),
        gender: s(d.gender),
        birthDate: rawBirthDate,
        joinDate: rawJoinDate,
        age: computedAge,
        yearsOfService: computedService.years,
        monthsHasuu: computedService.months,
        areaCode: s(d.area_code),
        addressCode: s(d.address_code),
        role: (d.authority === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        profileImage: typeof window !== 'undefined' ? (localStorage.getItem(`profile_image_${d.id}`) || '') : '',
        authId: s(d.auth_id),
        version: Number(d.version) || 1,
        updatedAt: s(d.updated_at),
    };
};

const mapEmployeeToDb = (t: Partial<Employee> & { auth_id?: string }) => ({
    employee_code: t.code,
    auth_id: t.auth_id,
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
    version: t.version,
});

const mapAreaFromDb = (d: any): Area => ({
    id: d.area_code,
    areaCode: s(d.area_code),
    areaName: s(d.area_name),
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
});

const mapAreaToDb = (t: Partial<Area>) => ({
    area_code: t.areaCode,
    area_name: t.areaName,
    version: t.version,
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
    version: Number(d.version) || 1,
    updatedAt: s(d.updated_at),
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
    version: t.version,
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [fetchStatus, setFetchStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({
        iphones: 'idle',
        tablets: 'idle',
        featurephones: 'idle',
        routers: 'idle',
        employees: 'idle',
        addresses: 'idle',
        areas: 'idle',
    });
    const { user } = useAuth();
    const { showToast, dismissToast } = useToast();
    const { confirm, ConfirmDialog } = useConfirm();
    const pathname = usePathname();
    const lastSyncMetadata = useRef<Record<string, SyncMetadata>>({});
    const lastSyncTime = useRef<number>(0);
    const SYNC_COOLDOWN = 3000; // 3 seconds
    const isFirstLoad = useRef(true);


    const fetchIPhones = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.iphones === 'loading' || fetchStatus.iphones === 'success')) return;
        setFetchStatus(prev => ({ ...prev, iphones: 'loading' }));
        try {
            const data = await fetchIPhonesAction();
            if (data) setIPhones(data.map(mapIPhoneFromDb));
            setFetchStatus(prev => ({ ...prev, iphones: 'success' }));
        } catch (error) {
            console.error('Failed to fetch iPhones:', error);
            setFetchStatus(prev => ({ ...prev, iphones: 'error' }));
        }
    }, [fetchStatus.iphones]);

    const fetchTablets = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.tablets === 'loading' || fetchStatus.tablets === 'success')) return;
        setFetchStatus(prev => ({ ...prev, tablets: 'loading' }));
        try {
            const data = await fetchTabletsAction();
            if (data) setTablets(data.map(mapTabletFromDb));
            setFetchStatus(prev => ({ ...prev, tablets: 'success' }));
        } catch (error) {
            console.error('Failed to fetch Tablets:', error);
            setFetchStatus(prev => ({ ...prev, tablets: 'error' }));
        }
    }, [fetchStatus.tablets]);

    const fetchFeaturePhones = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.featurephones === 'loading' || fetchStatus.featurephones === 'success')) return;
        setFetchStatus(prev => ({ ...prev, featurephones: 'loading' }));
        try {
            const data = await fetchFeaturePhonesAction();
            if (data) setFeaturePhones(data.map(mapFeaturePhoneFromDb));
            setFetchStatus(prev => ({ ...prev, featurephones: 'success' }));
        } catch (error) {
            console.error('Failed to fetch FeaturePhones:', error);
            setFetchStatus(prev => ({ ...prev, featurephones: 'error' }));
        }
    }, [fetchStatus.featurephones]);

    const fetchRouters = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.routers === 'loading' || fetchStatus.routers === 'success')) return;
        setFetchStatus(prev => ({ ...prev, routers: 'loading' }));
        try {
            const data = await fetchRoutersAction();
            if (data) setRouters(data.map(mapRouterFromDb));
            setFetchStatus(prev => ({ ...prev, routers: 'success' }));
        } catch (error) {
            console.error('Failed to fetch Routers:', error);
            setFetchStatus(prev => ({ ...prev, routers: 'error' }));
        }
    }, [fetchStatus.routers]);

    const fetchEmployees = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.employees === 'loading' || fetchStatus.employees === 'success')) return;
        setFetchStatus(prev => ({ ...prev, employees: 'loading' }));
        try {
            const data = await fetchEmployeesAction();
            if (data) setEmployees(data.map(mapEmployeeFromDb));
            setFetchStatus(prev => ({ ...prev, employees: 'success' }));
        } catch (error) {
            console.error('Failed to fetch Employees:', error);
            setFetchStatus(prev => ({ ...prev, employees: 'error' }));
            throw error;
        }
    }, [fetchStatus.employees]);

    const fetchAddresses = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.addresses === 'loading' || fetchStatus.addresses === 'success')) return;
        setFetchStatus(prev => ({ ...prev, addresses: 'loading' }));
        try {
            const data = await fetchAddressesAction();
            if (data) setAddresses(data.map(mapAddressFromDb));
            setFetchStatus(prev => ({ ...prev, addresses: 'success' }));
        } catch (error) {
            console.error('Failed to fetch Addresses:', error);
            setFetchStatus(prev => ({ ...prev, addresses: 'error' }));
        }
    }, [fetchStatus.addresses]);

    const fetchAreas = useCallback(async (force: boolean = false) => {
        if (!force && (fetchStatus.areas === 'loading' || fetchStatus.areas === 'success')) return;
        setFetchStatus(prev => ({ ...prev, areas: 'loading' }));
        try {
            const data = await fetchAreasAction();
            if (data) setAreas(data.map(mapAreaFromDb));
            setFetchStatus(prev => ({ ...prev, areas: 'success' }));
        } catch (error) {
            console.error('Failed to fetch Areas:', error);
            setFetchStatus(prev => ({ ...prev, areas: 'error' }));
        }
    }, [fetchStatus.areas]);

    const syncDataIfNeeded = useCallback(async () => {
        if (!user) return;

        const now = Date.now();
        if (now - lastSyncTime.current < SYNC_COOLDOWN) {
            console.log('[Sync] Skipping sync (cooldown active)');
            return;
        }
        lastSyncTime.current = now;

        try {
            console.log('[Sync] Checking for remote changes...');
            const remoteMetadata = await getSyncMetadataAction();
            const staleTables: string[] = [];

            remoteMetadata.forEach(remote => {
                const local = lastSyncMetadata.current[remote.table];
                if (!local || local.lastUpdated !== remote.lastUpdated || local.count !== remote.count) {
                    staleTables.push(remote.table);
                }
                lastSyncMetadata.current[remote.table] = remote;
            });

            if (staleTables.length > 0) {
                console.log('[Sync] Refreshing stale tables:', staleTables);
                if (staleTables.includes('iphones')) fetchIPhones(true);
                if (staleTables.includes('tablets')) fetchTablets(true);
                if (staleTables.includes('featurephones')) fetchFeaturePhones(true);
                if (staleTables.includes('routers')) fetchRouters(true);
                if (staleTables.includes('employees')) fetchEmployees(true);
                if (staleTables.includes('areas')) fetchAreas(true);
                if (staleTables.includes('addresses')) fetchAddresses(true);
            }
        } catch (error) {
            console.error('Data sync failed:', error);
        }
    }, [fetchIPhones, fetchTablets, fetchFeaturePhones, fetchRouters, fetchEmployees, fetchAreas, fetchAddresses, user]);

    // Sync on pathname change
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        syncDataIfNeeded();
    }, [pathname, syncDataIfNeeded]);

    const fetchData = useCallback(async () => {
        try {
            // Fetch core master data and sync metadata concurrently
            const [meta] = await Promise.all([
                getSyncMetadataAction(),
                fetchEmployees(),
                fetchAddresses(),
                fetchAreas(),
            ]);

            // Initialize sync metadata baseline
            if (meta) {
                meta.forEach(rem => {
                    lastSyncMetadata.current[rem.table] = rem;
                });
            }

            // Default fetch: Current week's logs
            const { start, end } = getWeekRange(new Date());
            const logData = await fetchAuditLogsAction(start.toISOString(), end.toISOString());
            if (logData) setLogs(logData.map(logService.mapLogFromDb));

        } catch (error) {
            console.error('Failed to fetch data:', error);
            showToast('データ読み込みに失敗しました', 'error');
        }
    }, [supabase, showToast, fetchEmployees, fetchAddresses, fetchAreas]);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, fetchData]);

    const refreshTable = useCallback(async (table: string) => {
        switch (table) {
            case 'tablets': await fetchTablets(true); break;
            case 'iphones': await fetchIPhones(true); break;
            case 'featurephones': await fetchFeaturePhones(true); break;
            case 'routers': await fetchRouters(true); break;
            case 'employees': await fetchEmployees(true); break;
            case 'areas': await fetchAreas(true); break;
            case 'addresses': await fetchAddresses(true); break;
        }
    }, [fetchTablets, fetchIPhones, fetchFeaturePhones, fetchRouters, fetchEmployees, fetchAreas, fetchAddresses]);

    // Generic CRUD helpers (Deprecated in favor of specific server actions)
    // Removed to ensure all logic goes through Server Actions as per "Don't trust app side" principle
    // Added user and supabase to dependencies

    // Specific implementations
    const handleCRUDError = useCallback(async (table: string, error: any, skipToast: boolean = false, skipDialog: boolean = false, operationName: string = '処理', itemIdentifier: string = '不明なデータ') => {
        // Ensure we handle various error formats correctly
        const errorBody = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        const errorStr = String(errorBody);

        const isDuplicate = errorStr.includes('DuplicateError');
        const isConflict = errorStr.includes('ConcurrencyError');
        const isNotFound = errorStr.includes('NotFoundError');

        if (isDuplicate || isConflict || isNotFound) {
            let title = `${operationName}エラー`;
            let errorReason = isDuplicate ? '競合エラー（既に登録済みのデータです）' :
                isConflict ? '競合エラー（他のユーザーが更新しました）' :
                    operationName === '削除' ? '他社員がデータの編集を行ったため、削除を中止します。' :
                    `他社員がデータの削除を行ったため、${operationName}を中止します。`;

            let isDetailed = false;
            // 詳細な重複情報のパース
            if (isDuplicate && errorStr.includes(':')) {
                const parts = errorStr.split('DuplicateError:');
                const rawDetails = parts[parts.length - 1]?.trim();
                let details = '';

                // Try parsing as JSON first
                if (rawDetails.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(rawDetails);
                        details = parsed.details || parsed.detail || parsed.message || '';
                    } catch (e) {
                        details = rawDetails;
                    }
                } else {
                    details = rawDetails;
                }

                // Supabase detail format: "Key (area_name)=(東京) already exists."
                const match = details?.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
                if (match) {
                    const field = match[1].trim();
                    const value = match[2].trim();
                    const fieldMap: Record<string, string> = {
                        'area_code': 'エリアコード',
                        'area_name': 'エリア名',
                        'address_code': '拠点コード',
                        'office_name': '拠点名',
                        'terminal_code': '端末CD',
                        'management_number': '管理番号',
                        'phone_number': '電話番号',
                        'employee_code': '社員コード',
                        'email': 'メールアドレス',
                        'auth_id': '認証ID'
                    };
                    const fieldLabel = fieldMap[field] || field;
                    errorReason = `競合エラー（${fieldLabel}「${value}」は既に登録されています）`;
                    isDetailed = true;
                }
            }

            let descriptionNode = (
                <div className="max-h-60 overflow-y-auto">
                    <p className="mb-2 font-bold text-red-600">エラーが存在するため、{operationName}を中止しました。</p>
                    <ul className="list-disc pl-5 text-sm text-red-600">
                        <li>
                            {isNotFound ? '競合エラー：' : `${operationName}エラー:`}
                            {!isDetailed && `${isNotFound ? '' : ' '}${itemIdentifier}${isNotFound ? ' ' : ' - '}`}
                            {errorReason}
                        </li>
                    </ul>
                </div>
            );

            if (!skipDialog) {
                await confirm({
                    title,
                    description: descriptionNode,
                    confirmText: 'OK',
                    cancelText: ''
                });
            }

            setIsSyncing(true);
            try {
                await refreshTable(table);
            } finally {
                setIsSyncing(false);
            }
        } else if (!skipToast) {
            showToast('エラーが発生しました', 'error', error.message || '不明なエラー');
        }
    }, [confirm, showToast, refreshTable]);

    // Unified delete many helper using ID + version
    const deleteManyItems = useCallback(async (
        table: string,
        itemsToProcess: { id: string, version: number }[],
        setState: React.Dispatch<React.SetStateAction<any[]>>,
        bulkDeleteAction: (items: { id: string, version: number }[]) => Promise<any>
    ) => {
        try {
            setIsSyncing(true);
            const result = await bulkDeleteAction(itemsToProcess);

            if (!result.success) {
                await handleCRUDError(table, new Error(result.error), false);
                return;
            }

            const successIds = itemsToProcess.map(i => i.id);
            setState(prev => prev.filter(p => !successIds.includes(p.id)));
            showToast(`${successIds.length}件、削除しました`, 'success');
        } catch (error: any) {
            console.error(`Bulk delete failed for ${table}:`, error);
            await handleCRUDError(table, error, false);
        } finally {
            setIsSyncing(false);
        }
    }, [showToast, handleCRUDError]);

    const addTablet = async (item: Omit<Tablet, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createTabletAction(item);
            if (!result.success) {
                await handleCRUDError('tablets', new Error(result.error), skipToast, skipDialog, '新規登録', item.terminalCode);
                throw new Error(result.error);
            }
            setTablets(prev => [...prev, mapTabletFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('tablets', error, skipToast, skipDialog, '新規登録', item.terminalCode);
            }
            throw error;
        }
    };
    const updateTablet = async (item: Tablet, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const { id, ...data } = item;
            const result = await updateTabletAction(id, data, item.version);
            if (!result.success) {
                await handleCRUDError('tablets', new Error(result.error), skipToast, skipDialog, '編集', item.terminalCode);
                throw new Error(result.error);
            }
            setTablets(prev => prev.map(p => p.id === item.id ? mapTabletFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('tablets', error, skipToast, skipDialog, '編集', item.terminalCode);
            }
            throw error;
        }
    };
    const deleteTablet = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteTabletAction(id, version);
        if (!result.success) {
            const item = tablets.find(t => t.id === id);
            await handleCRUDError('tablets', new Error(result.error), skipToast, skipDialog, '削除', item?.terminalCode || '不明なデータ');
            throw new Error(result.error);
        }
        setTablets(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const addIPhone = async (item: Omit<IPhone, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createIPhoneAction(item);
            if (!result.success) {
                await handleCRUDError('iphones', new Error(result.error), skipToast, skipDialog, '新規登録', item.managementNumber);
                throw new Error(result.error);
            }
            setIPhones(prev => [...prev, mapIPhoneFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('iphones', error, skipToast, skipDialog);
            }
            throw error;
        }
    };
    const updateIPhone = async (item: IPhone, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const { id, ...data } = item;
            const result = await updateIPhoneAction(id, data, item.version);
            if (!result.success) {
                await handleCRUDError('iphones', new Error(result.error), skipToast, skipDialog, '編集', item.managementNumber);
                throw new Error(result.error);
            }
            setIPhones(prev => prev.map(p => p.id === item.id ? mapIPhoneFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('iphones', error, skipToast, skipDialog);
            }
            throw error;
        }
    };
    const deleteIPhone = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteIPhoneAction(id, version);
        if (!result.success) {
            const item = iPhones.find(i => i.id === id);
            await handleCRUDError('iphones', new Error(result.error), skipToast, skipDialog, '削除', item?.managementNumber || '不明なデータ');
            throw new Error(result.error);
        }
        setIPhones(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const addFeaturePhone = async (item: Omit<FeaturePhone, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createFeaturePhoneAction(item);
            if (!result.success) {
                await handleCRUDError('featurephones', new Error(result.error), skipToast, skipDialog, '新規登録', item.managementNumber);
                throw new Error(result.error);
            }
            setFeaturePhones(prev => [...prev, mapFeaturePhoneFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('featurephones', error, skipToast, skipDialog, '新規登録', item.managementNumber);
            }
            throw error;
        }
    };
    const updateFeaturePhone = async (item: FeaturePhone, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const { id, ...data } = item;
            const result = await updateFeaturePhoneAction(id, data, item.version);
            if (!result.success) {
                await handleCRUDError('featurephones', new Error(result.error), skipToast, skipDialog, '編集', item.managementNumber);
                throw new Error(result.error);
            }
            setFeaturePhones(prev => prev.map(p => p.id === item.id ? mapFeaturePhoneFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('featurephones', error, skipToast, skipDialog, '編集', item.managementNumber);
            }
            throw error;
        }
    };
    const deleteFeaturePhone = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteFeaturePhoneAction(id, version);
        if (!result.success) {
            const item = featurePhones.find(p => p.id === id);
            await handleCRUDError('featurephones', new Error(result.error), skipToast, skipDialog, '削除', item?.managementNumber || '不明なデータ');
            throw new Error(result.error);
        }
        setFeaturePhones(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const addRouter = async (item: Omit<Router, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createRouterAction(item);
            if (!result.success) {
                await handleCRUDError('routers', new Error(result.error), skipToast, skipDialog, '新規登録', item.terminalCode);
                throw new Error(result.error);
            }
            setRouters(prev => [...prev, mapRouterFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('routers', error, skipToast, skipDialog, '新規登録', item.terminalCode);
            }
            throw error;
        }
    };
    const updateRouter = async (item: Router, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const { id, ...data } = item;
            const result = await updateRouterAction(id, data, item.version);
            if (!result.success) {
                await handleCRUDError('routers', new Error(result.error), skipToast, skipDialog, '編集', item.terminalCode);
                throw new Error(result.error);
            }
            setRouters(prev => prev.map(p => p.id === item.id ? mapRouterFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('routers', error, skipToast, skipDialog, '編集', item.terminalCode);
            }
            throw error;
        }
    };
    const deleteRouter = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteRouterAction(id, version);
        if (!result.success) {
            const item = routers.find(r => r.id === id);
            await handleCRUDError('routers', new Error(result.error), skipToast, skipDialog, '削除', item?.terminalCode || '不明なデータ');
            throw new Error(result.error);
        }
        setRouters(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };


    const addEmployee = async (item: Omit<Employee, 'id' | 'version' | 'updatedAt'> & { id?: string, password?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            // 1. Create Auth User via API
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Auth Registration Failed: ${errorText}`);
            }

            const authResult = await response.json();
            if (authResult.userId) {
                (item as any).auth_id = authResult.userId;
            }

            // 2. Insert into DB (via Server Action with compensation logic)
            const result = await createEmployeeAction(item);
            if (!result.success) {
                await handleCRUDError('employees', new Error(result.error), skipToast, skipDialog, '新規登録', item.code || item.name);
                throw new Error(result.error);
            }
            setEmployees(prev => [...prev, mapEmployeeFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('employees', error, skipToast, skipDialog, '新規登録', item.code || item.name);
            }
            throw error;
        }
    };
    const updateEmployee = async (item: Employee, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await updateEmployeeAction(item.id, item);
            if (!result.success) {
                await handleCRUDError('employees', new Error(result.error), skipToast, skipDialog, '編集', item.code || item.name);
                throw new Error(result.error);
            }
            setEmployees(prev => prev.map(p => p.id === item.id ? mapEmployeeFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('employees', error, skipToast, skipDialog, '編集', item.code || item.name);
            }
            throw error;
        }
    };
    const deleteEmployee = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteEmployeeAction(id, version);
        if (!result.success) {
            const item = employees.find(e => e.id === id);
            await handleCRUDError('employees', new Error(result.error), skipToast, skipDialog, '削除', item?.code || item?.name || '不明なデータ');
            throw new Error(result.error);
        }
        setEmployees(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const addArea = async (item: Omit<Area, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createAreaAction(item);
            if (!result.success) {
                await handleCRUDError('areas', new Error(result.error), skipToast, skipDialog, '新規登録', item.areaCode);
                throw new Error(result.error);
            }
            setAreas(prev => [...prev, mapAreaFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('areas', error, skipToast, skipDialog, '新規登録', item.areaCode);
            }
            throw error;
        }
    };
    const updateArea = async (item: Area, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await updateAreaAction(item.areaCode, item, item.version);
            if (!result.success) {
                await handleCRUDError('areas', new Error(result.error), skipToast, skipDialog, '編集', item.areaCode);
                throw new Error(result.error);
            }
            setAreas(prev => prev.map(p => p.id === item.id ? mapAreaFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('areas', error, skipToast, skipDialog, '編集', item.areaCode);
            }
            throw error;
        }
    };
    const deleteArea = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteAreaAction(id, version);
        if (!result.success) {
            const item = areas.find(a => a.id === id);
            await handleCRUDError('areas', new Error(result.error), skipToast, skipDialog, '削除', item?.areaCode || '不明なデータ');
            throw new Error(result.error);
        }
        setAreas(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const addAddress = async (item: Omit<Address, 'id' | 'version' | 'updatedAt'> & { id?: string }, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await createAddressAction(item);
            if (!result.success) {
                await handleCRUDError('addresses', new Error(result.error), skipToast, skipDialog, '新規登録', item.addressCode);
                throw new Error(result.error);
            }
            setAddresses(prev => [...prev, mapAddressFromDb(result.data)]);
            if (!skipToast) showToast('登録しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('addresses', error, skipToast, skipDialog, '新規登録', item.addressCode);
            }
            throw error;
        }
    };
    const updateAddress = async (item: Address, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        try {
            const result = await updateAddressAction(item.id, item, item.version);
            if (!result.success) {
                await handleCRUDError('addresses', new Error(result.error), skipToast, skipDialog, '編集', item.addressCode);
                throw new Error(result.error);
            }
            setAddresses(prev => prev.map(p => p.id === item.id ? mapAddressFromDb(result.data) : p));
            if (!skipToast) showToast('更新しました', 'success');
        } catch (error) {
            if (!(error instanceof Error && (error.message.startsWith('DuplicateError') || error.message.startsWith('NotFoundError') || error.message.startsWith('ConcurrencyError')))) {
                await handleCRUDError('addresses', error, skipToast, skipDialog, '編集', item.addressCode);
            }
            throw error;
        }
    };
    const deleteAddress = async (id: string, version: number, skipLog: boolean = false, skipToast: boolean = false, skipDialog: boolean = false) => {
        const result = await deleteAddressAction(id, version);
        if (!result.success) {
            const item = addresses.find(a => a.id === id);
            await handleCRUDError('addresses', new Error(result.error), skipToast, skipDialog, '削除', item?.addressCode || '不明なデータ');
            throw new Error(result.error);
        }
        setAddresses(prev => prev.filter(p => p.id !== id));
        if (!skipToast) showToast('削除しました', 'success');
        return result;
    };

    const deleteManyIPhones = async (ids: string[]) => {
        const items = iPhones.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('iphones', items, setIPhones, deleteManyIPhonesAction);
    };
    const deleteManyFeaturePhones = async (ids: string[]) => {
        const items = featurePhones.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('featurephones', items, setFeaturePhones, deleteManyFeaturePhonesAction);
    };
    const deleteManyTablets = async (ids: string[]) => {
        const items = tablets.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('tablets', items, setTablets, deleteManyTabletsAction);
    };
    const deleteManyRouters = async (ids: string[]) => {
        const items = routers.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('routers', items, setRouters, deleteManyRoutersAction);
    };
    const deleteManyEmployees = async (ids: string[]) => {
        if (user?.id === 'INITIAL_SETUP_ACCOUNT') {
            try {
                setIsSyncing(true);
                await deleteManyEmployeesBySetupAdmin(ids);
                setEmployees(prev => prev.filter(p => !ids.includes(p.id)));
                showToast(`${ids.length}件、削除しました (Setup)`, 'success');
            } catch (error: any) {
                showToast('削除に失敗しました', 'error', error.message);
            } finally {
                setIsSyncing(false);
            }
            return;
        }
        const items = employees.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('employees', items, setEmployees, deleteManyEmployeesAction);
    };
    const deleteManyAreas = async (ids: string[]) => {
        const items = areas.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('areas', items, setAreas, deleteManyAreasAction);
    };
    const deleteManyAddresses = async (ids: string[]) => {
        const items = addresses.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, version: p.version }));
        await deleteManyItems('addresses', items, setAddresses, deleteManyAddressesAction);
    };

    const fetchLogRange = useCallback(async (startDate: string, endDate: string) => {
        try {
            const data = await fetchAuditLogsAction(startDate, endDate);
            if (data) setLogs(data.map(logService.mapLogFromDb));
        } catch (error: any) {
            console.error('Failed to fetch log range:', error.message);
        }
    }, []);

    const fetchLogMinDate = useCallback(async (): Promise<string | null> => {
        try {
            return await fetchLogMinDateAction();
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
            logs,
            employeeMap: React.useMemo(() => new Map(employees.map(e => [e.code, e])), [employees]),
            addressMap: React.useMemo(() => new Map(addresses.map(a => [a.addressCode, a])), [addresses]),
            fetchIPhones,
            fetchTablets,
            fetchFeaturePhones,
            fetchRouters,
            fetchEmployees,
            fetchAddresses,
            fetchAreas,
            handleCRUDError,
            setIsSyncing,
        }}>
            {children}
            <ConfirmDialog />
            {isSyncing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FEFEF8]/80 backdrop-blur-sm">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="h-10 w-10 bg-[#0EA5E9] rounded-lg shadow-sm border-2 border-[#0A0E27]"></div>
                        <span className="text-[#0A0E27]/50 font-display">データを読み込み中...</span>
                    </div>
                </div>
            )}
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
