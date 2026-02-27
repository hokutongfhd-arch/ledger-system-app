import { normalizeContractYear } from '../../lib/utils/stringUtils';
import { formatPhoneNumber } from '../../lib/utils/phoneUtils';

export interface DeviceImportRow {
    [key: string]: any;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    data?: any;
    normalizedPhone?: string;
    managementNumber?: string;
}

export const validateDeviceImportRow = (
    row: DeviceImportRow,
    rowIndex: number,
    existingPhoneNumbers: Set<string>,
    processedPhoneNumbers: Set<string>,
    existingManagementNumbers: Set<string>,
    processedManagementNumbers: Set<string>,
    validEmployeeCodes?: Set<string>,
    validOfficeCodes?: Set<string>
): ValidationResult => {
    const errors: string[] = [];
    const rowNumber = rowIndex + 2; // Excel row number (1-based, +1 for header)

    // Helper functions
    const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

    // Fields
    const rawManagementNumber = String(row['管理番号(必須)'] || '');
    const managementNumber = toHalfWidth(rawManagementNumber).trim();

    // Management Number Validation
    if (!managementNumber) {
        errors.push(`${rowNumber}行目: 管理番号が空です`);
    } else {
        if (/[^\x20-\x7E]/.test(rawManagementNumber)) {
            errors.push(`${rowNumber}行目: 管理番号に全角文字が含まれています`);
        } else if (existingManagementNumbers.has(managementNumber)) {
            errors.push(`${rowNumber}行目: 管理番号「${managementNumber}」は既に存在します`);
        } else if (processedManagementNumbers.has(managementNumber)) {
            errors.push(`${rowNumber}行目: 管理番号「${managementNumber}」がファイル内で重複しています`);
        }
    }

    // Phone Number Validation
    const rawPhoneNumber = String(row['電話番号(必須)'] || '');
    const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());
    const normalizedPhone = normalizePhone(phoneNumber);

    if (!phoneNumber) {
        errors.push(`${rowNumber}行目: 電話番号が空です`);
    } else {
        const phoneRegex = /^(\d{11}|\d{3}-\d{4}-\d{4})$/;
        const cleanRawPhone = toHalfWidth(rawPhoneNumber).trim();
        if (!phoneRegex.test(cleanRawPhone)) {
            errors.push(`${rowNumber}行目: 電話番号「${cleanRawPhone}」は不正な形式です (11桁の数値 または xxx-xxxx-xxxx)`);
        }

        if (existingPhoneNumbers.has(normalizedPhone)) {
            errors.push(`${rowNumber}行目: 電話番号「${phoneNumber}」は既に存在します`);
        } else if (processedPhoneNumbers.has(normalizedPhone)) {
            errors.push(`${rowNumber}行目: 電話番号「${phoneNumber}」がファイル内で重複しています`);
        }
    }

    // Carrier
    const validCarriers = ['KDDI', 'SoftBank', 'Docomo', 'Rakuten', 'その他'];
    const carrier = String(row['キャリア'] || '').trim();
    if (carrier && !validCarriers.includes(carrier)) {
        errors.push(`${rowNumber}行目: キャリア「${carrier}」は不正な値です`);
    }

    // Status
    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];
    const statusRaw = String(row['状況'] || '').trim();
    if (statusRaw && !validStatuses.includes(statusRaw)) {
        errors.push(`${rowNumber}行目: 状況「${statusRaw}」は不正な値です`);
    }

    // Employee Code
    const employeeCode = String(row['社員コード'] || '').trim();
    if (employeeCode) {
        if (!/^[0-9-]+$/.test(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コードに不正な文字が含まれています（半角数字と「-」のみ使用可能）`);
        } else if (validEmployeeCodes && !validEmployeeCodes.has(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コード「${employeeCode}」は社員マスタに存在しません`);
        }
    }

    // Office Code
    const officeCode = String(row['事業所コード'] || '').trim();
    if (officeCode) {
        if (!/^[0-9-]+$/.test(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コードに不正な文字が含まれています（半角数字と「-」のみ使用可能）`);
        } else if (validOfficeCodes && !validOfficeCodes.has(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コード「${officeCode}」は事業所マスタに存在しません`);
        }
    }

    // Date Validation Helper
    const isValidDate = (val: any) => {
        if (!val) return true;
        if (typeof val === 'number') return true;
        const str = String(val).trim();
        if (!str) return true;
        return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str);
    };

    const parseDeviceDate = (val: any): Date | null => {
        if (!val) return null;
        if (typeof val === 'number') {
            return new Date((val - 25569) * 86400 * 1000);
        }
        const str = String(val).trim();
        if (!str) return null;
        const d = new Date(str.replace(/-/g, '/'));
        if (isNaN(d.getTime())) return null;
        return d;
    };

    const validateDateConstraints = (val: any, fieldName: string) => {
        if (!isValidDate(val)) {
            errors.push(`${rowNumber}行目: ${fieldName}は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);
            return;
        }
        const dateObj = parseDeviceDate(val);
        if (dateObj) {
            const minDate = new Date('2000-01-01T00:00:00');
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() + 5);
            maxDate.setHours(23, 59, 59, 999);
            
            if (dateObj < minDate) {
                errors.push(`${rowNumber}行目: ${fieldName}は2000年以降の日付を入力してください`);
            } else if (dateObj > maxDate) {
                errors.push(`${rowNumber}行目: ${fieldName}はシステム利用日から5年以内の日付を入力してください`);
            }
        }
    };

    validateDateConstraints(row['貸与日'], '貸与日');
    validateDateConstraints(row['返却日'], '返却日');

    // SMART Address Validation
    const smartIdVal = row['SMARTアドレス帳ID'];
    const smartId = (smartIdVal !== undefined && smartIdVal !== null) ? String(smartIdVal).trim() : '';
    if (smartId && /[^\x20-\x7E]/.test(smartId)) {
        errors.push(`${rowNumber}行目: SMARTアドレス帳IDに全角文字が含まれています`);
    }

    const smartPwVal = row['SMARTアドレス帳PW'];
    const smartPw = (smartPwVal !== undefined && smartPwVal !== null) ? String(smartPwVal).trim() : '';
    if (smartPw && /[^\x20-\x7E]/.test(smartPw)) {
        errors.push(`${rowNumber}行目: SMARTアドレス帳PWに全角文字が含まれています`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalizedPhone,
        managementNumber
    };
};

export const validateRouterImportRow = (
    row: DeviceImportRow,
    rowIndex: number,
    existingSimNumbers: Set<string>,
    processedSimNumbers: Set<string>,
    existingTerminalCodes: Set<string>,
    processedTerminalCodes: Set<string>,
    validEmployeeCodes?: Set<string>,
    validOfficeCodes?: Set<string>
): ValidationResult => {
    const errors: string[] = [];
    const rowNumber = rowIndex + 2;

    const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

    const rawTerminalCode = String(row['端末CD(必須)'] || '');
    const terminalCode = toHalfWidth(rawTerminalCode).trim();
    if (!terminalCode) {
        errors.push(`${rowNumber}行目: 端末CDが空です`);
    } else {
        if (/[^\x20-\x7E]/.test(rawTerminalCode)) {
            errors.push(`${rowNumber}行目: 端末CDに全角文字が含まれています`);
        } else if (existingTerminalCodes.has(terminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${terminalCode}」は既に存在します`);
        } else if (processedTerminalCodes.has(terminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${terminalCode}」がファイル内で重複しています`);
        }
    }

    const rawSimNumber = String(row['SIM電番(必須)'] || '');
    const simNumber = formatPhoneNumber(toHalfWidth(rawSimNumber).trim());
    const normalizedSim = normalizePhone(simNumber);
    if (!normalizedSim && rawSimNumber.trim()) {
        errors.push(`${rowNumber}行目: SIM電番が空です`);
    }
    if (normalizedSim) {
        const simRegex = /^(\d{11}|\d{3}-\d{4}-\d{4}|\d{14})$/;
        const cleanRawSim = toHalfWidth(rawSimNumber).trim();
        if (!simRegex.test(cleanRawSim) && !simRegex.test(simNumber)) {
            errors.push(`${rowNumber}行目: SIM電番「${cleanRawSim}」は不正な形式です (11桁, xxx-xxxx-xxxx, または14桁)`);
        }
        if (existingSimNumbers.has(normalizedSim)) {
            errors.push(`${rowNumber}行目: SIM電番「${simNumber}」は既に存在します`);
        } else if (processedSimNumbers.has(normalizedSim)) {
            errors.push(`${rowNumber}行目: SIM電番「${simNumber}」がファイル内で重複しています`);
        }
    }

    const rawModelNumber = String(row['機種型番'] || '').trim();
    if (rawModelNumber && /[^\x20-\x7E]/.test(rawModelNumber)) {
        errors.push(`${rowNumber}行目: 機種型番「${rawModelNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
    }

    const validCarriers = ['au・wimax2+', 'au', 'docomo(iij)', 'SoftBank'];
    const carrier = String(row['通信キャリア'] || '').trim();
    if (carrier && !validCarriers.includes(carrier)) {
        errors.push(`${rowNumber}行目: 通信キャリア「${carrier}」は不正な値です`);
    }

    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];
    const statusRaw = String(row['状況'] || '').trim();
    if (statusRaw && !validStatuses.includes(statusRaw)) {
        errors.push(`${rowNumber}行目: 状況「${statusRaw}」は不正な値です`);
    }

    const employeeCode = String(row['社員コード'] || '').trim();
    if (employeeCode) {
        if (!/^[0-9-]+$/.test(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コードに不正な文字が含まれています（半角数字と「-」のみ使用可能）`);
        } else if (validEmployeeCodes && !validEmployeeCodes.has(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コード「${employeeCode}」は社員マスタに存在しません`);
        }
    }

    const officeCode = String(row['事業所コード'] || '').trim();
    if (officeCode) {
        if (!/^[0-9-]+$/.test(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コードに不正な文字が含まれています（半角数字と「-」のみ使用可能）`);
        } else if (validOfficeCodes && !validOfficeCodes.has(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コード「${officeCode}」は事業所マスタに存在しません`);
        }
    }

    const validateIpFormat = (value: string, fieldName: string) => {
        if (!value || value.trim() === '') return;
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipRegex.test(value)) {
            errors.push(`${rowNumber}行目: ${fieldName}「${value}」の形式が正しくありません`);
        }
    };
    validateIpFormat(String(row['IPアドレス'] || ''), 'IPアドレス');
    validateIpFormat(String(row['サブネットマスク'] || ''), 'サブネットマスク');
    validateIpFormat(String(row['開始IP'] || ''), '開始IP');
    validateIpFormat(String(row['終了IP'] || ''), '終了IP');

    const validateCostField = (value: any, fieldName: string) => {
        if (value === undefined || value === null || value === '') return;
        const strVal = String(value).trim();
        if (strVal && !/^[0-9]+$/.test(strVal)) {
            errors.push(`${rowNumber}行目: ${fieldName}は半角数字のみで入力してください`);
        }
    };

    validateCostField(row['費用'], '費用');
    validateCostField(row['費用振替'], '費用振替');

    return {
        isValid: errors.length === 0,
        errors,
        normalizedPhone: normalizedSim,
        managementNumber: terminalCode
    };
};

export const validateTabletImportRow = (
    row: DeviceImportRow,
    rowIndex: number,
    existingTerminalCodes: Set<string>,
    processedTerminalCodes: Set<string>,
    validEmployeeCodes?: Set<string>,
    validOfficeCodes?: Set<string>
): ValidationResult => {
    const errors: string[] = [];
    const rowNumber = rowIndex + 2;
    const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    const rawTerminalCode = String(row['端末CD(必須)'] || '');
    const terminalCode = toHalfWidth(rawTerminalCode).trim();
    if (!terminalCode) {
        errors.push(`${rowNumber}行目: 端末CDが空です`);
    } else {
        if (/[^\x20-\x7E]/.test(rawTerminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${rawTerminalCode}」に全角文字が含まれています。半角文字のみ使用可能です。`);
        } else if (existingTerminalCodes.has(terminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${terminalCode}」は既に存在します`);
        } else if (processedTerminalCodes.has(terminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${terminalCode}」がファイル内で重複しています`);
        }
    }

    const rawModelNumber = String(row['型番(必須)'] || '');
    if (rawModelNumber && /[^\x20-\x7E]/.test(rawModelNumber)) {
        errors.push(`${rowNumber}行目: 型番「${rawModelNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
    }

    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];
    const statusRaw = String(row['状況'] || '').trim();
    if (statusRaw && !validStatuses.includes(statusRaw)) {
        errors.push(`${rowNumber}行目: 状況「${statusRaw}」は不正な値です`);
    }

    const employeeCode = String(row['社員コード'] || '').trim();
    if (employeeCode) {
        if (!/^[0-9-]+$/.test(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コード「${employeeCode}」に不正な文字が含まれています（半角数字とハイフンのみ使用可能）`);
        } else if (validEmployeeCodes && !validEmployeeCodes.has(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コード「${employeeCode}」は社員マスタに存在しません`);
        }
    }

    const officeCode = String(row['事業所コード'] || '').trim();
    if (officeCode) {
        if (!/^[0-9-]+$/.test(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コード「${officeCode}」に不正な文字が含まれています（半角数字とハイフンのみ使用可能）`);
        } else if (validOfficeCodes && !validOfficeCodes.has(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コード「${officeCode}」は事業所マスタに存在しません`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        managementNumber: terminalCode
    };
};
