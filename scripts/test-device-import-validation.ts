// Minimal mock for dependencies
const formatPhoneNumber = (phone: string) => {
    // Basic mock: if 11 digits, format as 3-4-4
    const digits = phone.replace(/-/g, '');
    if (digits.length === 11) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    }
    return phone;
};

const normalizeContractYear = (val: string) => val; // Dummy

interface DeviceImportRow {
    [key: string]: any;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    data?: any;
    normalizedPhone?: string;
    managementNumber?: string;
}

// INLINED VALIDATOR LOGIC from src/features/devices/device-import-validator.ts
const validateDeviceImportRow = (
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
        // Strict Regex for "xxxxxxxxxxx(11桁)" or "xxx-xxxx-xxxx"
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

    return {
        isValid: errors.length === 0,
        errors,
        normalizedPhone,
        managementNumber
    };
};

// TEST RUNNER
const runTest = (name: string, row: any, expectedValid: boolean, expectedErrorIncludes?: string) => {
    const existingPhoneNumbers = new Set<string>();
    const processedPhoneNumbers = new Set<string>();
    const existingManagementNumbers = new Set<string>();
    const processedManagementNumbers = new Set<string>();

    const result = validateDeviceImportRow(
        row,
        0, // rowIndex
        existingPhoneNumbers,
        processedPhoneNumbers,
        existingManagementNumbers,
        processedManagementNumbers
    );

    if (result.isValid === expectedValid) {
        if (expectedErrorIncludes) {
            const hasError = result.errors.some(e => e.includes(expectedErrorIncludes));
            if (hasError) {
                console.log(`[PASS] ${name}`);
            } else {
                console.error(`[FAIL] ${name}: Expected error containing "${expectedErrorIncludes}", got: ${JSON.stringify(result.errors)}`);
                process.exit(1);
            }
        } else {
            console.log(`[PASS] ${name}`);
        }
    } else {
        console.error(`[FAIL] ${name}: Expected valid=${expectedValid}, got valid=${result.isValid}. Errors: ${JSON.stringify(result.errors)}`);
        process.exit(1);
    }
};

console.log('Starting Validation Tests...');

// 1. Valid 11 digits
runTest('Valid 11 digits', {
    '管理番号(必須)': 'M001',
    '電話番号(必須)': '09012345678'
}, true);

// 2. Valid 3-4-4
runTest('Valid 3-4-4', {
    '管理番号(必須)': 'M002',
    '電話番号(必須)': '090-1234-5678'
}, true);

// 3. Invalid format (10 digits)
runTest('Invalid 10 digits', {
    '管理番号(必須)': 'M003',
    '電話番号(必須)': '0901234567'
}, false, '不正な形式です');

// 4. Invalid format (hyphen placement)
runTest('Invalid hyphen placement', {
    '管理番号(必須)': 'M004',
    '電話番号(必須)': '090-12345-678'
}, false, '不正な形式です');

// 5. Full width valid (should be converted)
runTest('Full width valid', {
    '管理番号(必須)': 'M005',
    '電話番号(必須)': '０９０１２３４５６７８'
}, true);

console.log('All tests passed!');
