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
    processedManagementNumbers: Set<string>
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
        // Format Check: 11 digits or 3-4-4
        // formatPhoneNumber usually returns formatted string if possible, or original if not match
        // But we want STRICT validation here.
        // Let's rely on raw input check mostly but `formatPhoneNumber` might have added hyphens.

        // Strict Regex for "xxxxxxxxxxx(11桁)" or "xxx-xxxx-xxxx"
        const phoneRegex = /^(\d{11}|\d{3}-\d{4}-\d{4})$/;

        // We test against the `phoneNumber` which is formatted by `formatPhoneNumber` util?
        // Let's look at `formatPhoneNumber` implementation or behavior.
        // If the user inputs "09012345678", `formatPhoneNumber` likely returns "090-1234-5678".
        // If the user inputs "090-1234-5678", it stays same.
        // If the user inputs "03-1234-5678" (fixed line), it might format differently or stay same.
        // The requirement is specific: "xxxxxxxxxxx(11桁)" or "xxx-xxxx-xxxx".
        // So we should check the *half-width trimmed* version before or after formatting?
        // Use the `toHalfWidth(rawPhoneNumber).trim()` for the check to be safe against utils.

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

    // Common validations can be added here if needed (Carrier, Status, etc.)
    // For now, focusing on the Phone Number requirement as requested.

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

    // Date Validation Helper
    const isValidDate = (val: any) => {
        if (!val) return true; // Empty is valid
        if (typeof val === 'number') return true; // Excel serial date
        const str = String(val).trim();
        if (!str) return true;
        return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str);
    };

    if (!isValidDate(row['受領書提出日'])) errors.push(`${rowNumber}行目: 受領書提出日は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);
    if (!isValidDate(row['貸与日'])) errors.push(`${rowNumber}行目: 貸与日は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);
    if (!isValidDate(row['返却日'])) errors.push(`${rowNumber}行目: 返却日は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);


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
    processedTerminalCodes: Set<string>
): ValidationResult => {
    const errors: string[] = [];
    const rowNumber = rowIndex + 2;

    // Helper functions
    const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

    // Terminal Code (Managed ID equivalent)
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

    // SIM Number Validation
    const rawSimNumber = String(row['SIM電番(必須)'] || '');
    const simNumber = formatPhoneNumber(toHalfWidth(rawSimNumber).trim());
    const normalizedSim = normalizePhone(simNumber);

    if (!normalizedSim) {
        // If it's empty, and it is required
        // Note: The original logic treated empty normalized string as existing?????
        // Let's stick to "If normalized is empty, raw was likely empty or just symbols"
        // If raw was not empty but normalized is, that's weird.
        if (rawSimNumber.trim() !== '') {
            // maybe it was all hyphens?
        }
        // If raw is empty, push error
        if (!rawSimNumber.trim()) {
            errors.push(`${rowNumber}行目: SIM電番が空です`);
        }
    }

    if (normalizedSim) {
        // Format Check: 11 digits, 3-4-4, or 14 digits
        // Regex: 
        // 1. 11 digits: ^\d{11}$
        // 2. 3-4-4: ^\d{3}-\d{4}-\d{4}$
        // 3. 14 digits: ^\d{14}$
        const simRegex = /^(\d{11}|\d{3}-\d{4}-\d{4}|\d{14})$/;
        const cleanRawSim = toHalfWidth(rawSimNumber).trim();

        // We use the cleaned raw for format check, OR the formatted one?
        // formatPhoneNumber might transform 11 digits to 3-4-4.
        // It DOES NOT add hyphens to 14 digits.
        // So checking `simNumber` (formatted) is safer if we want to allow "09012345678" as input but treat as valid.

        // However, the previous validator used `cleanRawPhone` for strict regex check. 
        // But for Router, we want to allow 14 digits.
        // Let's use `cleanRawSim` for the check to see what the USER entered.

        if (!simRegex.test(cleanRawSim) && !simRegex.test(simNumber)) {
            errors.push(`${rowNumber}行目: SIM電番「${cleanRawSim}」は不正な形式です (11桁, xxx-xxxx-xxxx, または14桁)`);
        }

        if (existingSimNumbers.has(normalizedSim)) {
            errors.push(`${rowNumber}行目: SIM電番「${simNumber}」は既に存在します`);
        } else if (processedSimNumbers.has(normalizedSim)) {
            errors.push(`${rowNumber}行目: SIM電番「${simNumber}」がファイル内で重複しています`);
        }
    }

    // Carrier Validation
    const validCarriers = ['au・wimax2+', 'au', 'docomo(iij)', 'SoftBank'];
    const carrier = String(row['通信キャリア'] || '').trim();
    if (carrier && !validCarriers.includes(carrier)) {
        errors.push(`${rowNumber}行目: 通信キャリア「${carrier}」は不正な値です`);
    }

    // IP Address Validation
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

    // Employee Code
    const employeeCode = String(row['社員コード'] || '').trim();
    if (employeeCode && !/^[0-9-]+$/.test(employeeCode)) {
        errors.push(`${rowNumber}行目: 社員コードに不正な文字が含まれています`);
    }

    // Office Code
    const officeCode = String(row['事業所コード'] || '').trim();
    if (officeCode && !/^[0-9-]+$/.test(officeCode)) {
        errors.push(`${rowNumber}行目: 事業所コードに不正な文字が含まれています`);
    }

    // Date Validation (if any fields exist - none in headers list but maybe in future?)
    // Routers have '備考(返却日)' but it's free text in the import map.

    return {
        isValid: errors.length === 0,
        errors,
        normalizedPhone: normalizedSim,
        managementNumber: terminalCode // Using terminalCode as managementNumber for return consistency
    };
};
