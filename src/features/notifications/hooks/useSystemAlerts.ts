import { useMemo } from 'react';
import { useData } from '../../context/DataContext';

export type AlertType =
    | 'unregistered_employee'
    | 'unregistered_address'
    | 'unregistered_area'
    | 'missing_receipt'
    | 'duplicate_terminal'
    | 'duplicate_management'
    | 'duplicate_phone'
    | 'duplicate_employee_code'
    | 'duplicate_area_code'
    | 'duplicate_address_code'
    | 'missing_employee_code'
    | 'missing_address_code'
    | 'missing_area_code'
    | 'contract_expiring';

export type AlertSource =
    | 'iPhone'
    | 'FeaturePhone'
    | 'Tablet'
    | 'Router'
    | 'Employee'
    | 'Area'
    | 'Address';

export interface SystemAlert {
    id: string; // unique key for list
    type: AlertType;
    source: AlertSource;
    message: string;
    recordId: string; // For navigation
    recordName?: string; // For display
    path: string; // Navigation path
}

export const useSystemAlerts = () => {
    const { tablets, iPhones, featurePhones, routers, employees, areas, addresses } = useData();

    const alerts = useMemo(() => {
        const result: SystemAlert[] = [];

        // Pre-compute Sets for O(1) lookups
        const employeeCodes = new Set(employees.map(e => e.code));
        const addressCodes = new Set(addresses.map(a => a.addressCode));
        const areaCodes = new Set(areas.map(a => a.areaCode));

        // Helper to check frequencies
        const checkDuplicates = (items: Record<string, any>[], key: string, source: AlertSource, path: string, label: string) => {
            const counts: Record<string, string[]> = {};
            items.forEach(item => {
                const val = String(item[key] || '').trim();
                if (val) {
                    if (!counts[val]) counts[val] = [];
                    counts[val].push(item.id);
                }
            });

            Object.entries(counts).forEach(([val, ids]) => {
                if (ids.length > 1) {
                    ids.forEach(id => {
                        result.push({
                            id: `dup-${source}-${id}-${key}`,
                            type: `duplicate_${key === 'terminalCode' ? 'terminal' : key === 'managementNumber' ? 'management' : key === 'phoneNumber' ? 'phone' : key === 'code' ? 'employee_code' : key === 'areaCode' ? 'area_code' : 'address_code'}` as AlertType,
                            source,
                            message: `${label}「${val}」が重複しています`,
                            recordId: id,
                            path: `${path}?highlight=${id}&field=${key}`
                        });
                    });
                }
            });
        };

        // Helper to check missing required codes
        const checkMissing = (items: Record<string, any>[], key: string, source: AlertSource, path: string, label: string, type: AlertType) => {
            items.forEach(item => {
                const val = String(item[key] || '').trim();
                // If value is empty, it means the code is missing but the record exists
                if (!val) {
                    result.push({
                        id: `missing-${source}-${item.id}-${key}`,
                        type: type,
                        source,
                        message: `${label}が登録されていません`,
                        recordId: item.id,
                        path: `${path}?highlight=${item.id}&field=${key}`
                    });
                }
            });
        };

        // 1. Unregistered Employee Code
        // iPhone
        iPhones.forEach(d => {
            if (d.employeeId && !employeeCodes.has(d.employeeId)) {
                result.push({
                    id: `unreg-emp-iphone-${d.id}`,
                    type: 'unregistered_employee',
                    source: 'iPhone',
                    message: `登録されていない社員コード「${d.employeeId}」が使用されています`,
                    recordId: d.id,
                    path: `/devices/iphones?highlight=${d.id}&field=employeeId`
                });
            }
        });
        // FeaturePhone
        featurePhones.forEach(d => {
            if (d.employeeId && !employeeCodes.has(d.employeeId)) {
                result.push({
                    id: `unreg-emp-fp-${d.id}`,
                    type: 'unregistered_employee',
                    source: 'FeaturePhone',
                    message: `登録されていない社員コード「${d.employeeId}」が使用されています`,
                    recordId: d.id,
                    path: `/devices/feature-phones?highlight=${d.id}&field=employeeId`
                });
            }
        });

        // 2. Unregistered Address Code
        // Tablet, iPhone, FeaturePhone, Router, Employee
        const checkAddress = (item: any, source: AlertSource, path: string) => {
            if (item.addressCode && !addressCodes.has(item.addressCode)) {
                result.push({
                    id: `unreg-addr-${source}-${item.id}`,
                    type: 'unregistered_address',
                    source,
                    message: `登録されていない住所コード「${item.addressCode}」が使用されています`,
                    recordId: item.id,
                    path: `${path}?highlight=${item.id}&field=addressCode`
                });
            }
        };
        tablets.forEach(i => checkAddress(i, 'Tablet', '/devices/tablets'));
        iPhones.forEach(i => checkAddress(i, 'iPhone', '/devices/iphones'));
        featurePhones.forEach(i => checkAddress(i, 'FeaturePhone', '/devices/feature-phones'));
        routers.forEach(i => checkAddress(i, 'Router', '/devices/routers'));
        employees.forEach(i => checkAddress(i, 'Employee', '/masters/employees'));

        // 3. Unregistered Area Code -> Employee
        employees.forEach(e => {
            if (e.areaCode && !areaCodes.has(e.areaCode)) {
                result.push({
                    id: `unreg-area-emp-${e.id}`,
                    type: 'unregistered_area',
                    source: 'Employee',
                    message: `登録されていないエリアコード「${e.areaCode}」が使用されています`,
                    recordId: e.id,
                    path: `/masters/employees?highlight=${e.id}&field=areaCode`
                });
            }
        });

        // 4. Receipt Date is NULL (iPhone, FeaturePhone)
        // Assume applies if lendDate is present (loaned) but receiptDate is missing
        iPhones.forEach(i => {
            if (i.lendDate && !i.receiptDate) {
                result.push({
                    id: `no-receipt-iphone-${i.id}`,
                    type: 'missing_receipt',
                    source: 'iPhone',
                    message: '受領書受領日が未入力です',
                    recordId: i.id,
                    path: `/devices/iphones?highlight=${i.id}&field=receiptDate`
                });
            }
        });
        featurePhones.forEach(f => {
            if (f.lendDate && !f.receiptDate) {
                result.push({
                    id: `no-receipt-fp-${f.id}`,
                    type: 'missing_receipt',
                    source: 'FeaturePhone',
                    message: '受領書受領日が未入力です',
                    recordId: f.id,
                    path: `/devices/feature-phones?highlight=${f.id}&field=receiptDate`
                });
            }
        });

        // 5. Duplicates Checks
        checkDuplicates(tablets, 'terminalCode', 'Tablet', '/devices/tablets', '端末CD');
        checkDuplicates(routers, 'terminalCode', 'Router', '/devices/routers', '端末CD');

        checkDuplicates(iPhones, 'managementNumber', 'iPhone', '/devices/iphones', '管理番号');
        checkDuplicates(featurePhones, 'managementNumber', 'FeaturePhone', '/devices/feature-phones', '管理番号');

        checkDuplicates(iPhones, 'phoneNumber', 'iPhone', '/devices/iphones', '電話番号');
        checkDuplicates(featurePhones, 'phoneNumber', 'FeaturePhone', '/devices/feature-phones', '電話番号');

        checkDuplicates(employees, 'code', 'Employee', '/masters/employees', '社員コード');
        checkDuplicates(areas, 'areaCode', 'Area', '/masters/areas', 'エリアコード');
        checkDuplicates(addresses, 'addressCode', 'Address', '/masters/addresses', '住所コード');

        // 6. Missing Code Checks
        // iPhone
        checkMissing(iPhones, 'employeeId', 'iPhone', '/devices/iphones', '社員コード', 'missing_employee_code');
        checkMissing(iPhones, 'addressCode', 'iPhone', '/devices/iphones', '住所コード', 'missing_address_code');

        // FeaturePhone
        checkMissing(featurePhones, 'employeeId', 'FeaturePhone', '/devices/feature-phones', '社員コード', 'missing_employee_code');
        checkMissing(featurePhones, 'addressCode', 'FeaturePhone', '/devices/feature-phones', '住所コード', 'missing_address_code');

        // Tablet
        checkMissing(tablets, 'employeeCode', 'Tablet', '/devices/tablets', '社員コード', 'missing_employee_code');
        checkMissing(tablets, 'addressCode', 'Tablet', '/devices/tablets', '住所コード', 'missing_address_code');

        // Router
        checkMissing(routers, 'employeeCode', 'Router', '/devices/routers', '社員コード', 'missing_employee_code');
        checkMissing(routers, 'addressCode', 'Router', '/devices/routers', '住所コード', 'missing_address_code');

        // Employee
        checkMissing(employees, 'areaCode', 'Employee', '/masters/employees', 'エリアコード', 'missing_area_code');
        checkMissing(employees, 'addressCode', 'Employee', '/masters/employees', '住所コード', 'missing_address_code');

        // 7. Contract Expiration Check
        const checkExpiry = (item: any, source: AlertSource, path: string) => {
            if (item.lendDate && item.contractYears) {
                const years = parseInt(item.contractYears, 10);
                if (!isNaN(years) && years > 0) {
                    const lendDate = new Date(item.lendDate);
                    const expiryDate = new Date(lendDate);
                    expiryDate.setFullYear(expiryDate.getFullYear() + years);

                    const today = new Date();
                    // Set time to midnight for accurate day difference
                    today.setHours(0, 0, 0, 0);
                    expiryDate.setHours(0, 0, 0, 0);

                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays <= 30) {
                        const isExpired = diffDays < 0;
                        const dateStr = expiryDate.toLocaleDateString('ja-JP');
                        result.push({
                            id: `expiry-${source}-${item.id}`,
                            type: 'contract_expiring',
                            source,
                            message: `契約が${isExpired ? '切れています' : '切れそうです'}。期限: ${dateStr} (${Math.abs(diffDays)}日${isExpired ? '超過' : '後'})`,
                            recordId: item.id,
                            path: `${path}?highlight=${item.id}`
                        });
                    }
                }
            }
        };

        iPhones.forEach(i => checkExpiry(i, 'iPhone', '/devices/iphones'));
        featurePhones.forEach(f => checkExpiry(f, 'FeaturePhone', '/devices/feature-phones'));
        // Note: Tablet and Router do not have lendDate in the current types, so skipping them.

        return result;
    }, [tablets, iPhones, featurePhones, routers, employees, areas, addresses]);

    return alerts;
};
