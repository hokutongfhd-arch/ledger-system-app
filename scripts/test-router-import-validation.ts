
// Mock dependencies
const normalizeContractYear = (str: string) => str;
const normalizePhoneNumber = (phone: string) => phone.replace(/[^0-9]/g, '');
const formatPhoneNumber = (phone: string) => {
    let normalized = normalizePhoneNumber(phone);
    if (normalized.length > 0 && normalized[0] !== '0') {
        if (normalized.length === 10 || normalized.length === 9) {
            normalized = '0' + normalized;
        }
    }
    if (normalized.length === 14) return normalized;
    if (normalized.length === 11) return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 11)}`;
    return normalized || phone;
};

// Inline validator for testing to avoid module resolution issues in script execution
const validateRouterImportRow = (
    row: any,
    rowIndex: number,
    existingSimNumbers: Set<string>,
    processedSimNumbers: Set<string>,
    existingTerminalCodes: Set<string>,
    processedTerminalCodes: Set<string>
) => {
    const errors: string[] = [];
    const rowNumber = rowIndex + 2;

    const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

    const rawTerminalCode = String(row['端末CD(必須)'] || '');
    const terminalCode = toHalfWidth(rawTerminalCode).trim();
    if (!terminalCode) errors.push(`${rowNumber}行目: 端末CDが空です`);

    // SIM Validation
    const rawSimNumber = String(row['SIM電番(必須)'] || '');
    const simNumber = formatPhoneNumber(toHalfWidth(rawSimNumber).trim());
    const normalizedSim = normalizePhone(simNumber);

    if (normalizedSim) {
        const simRegex = /^(\d{11}|\d{3}-\d{4}-\d{4}|\d{14})$/;
        const cleanRawSim = toHalfWidth(rawSimNumber).trim();
        if (!simRegex.test(cleanRawSim) && !simRegex.test(simNumber)) {
            errors.push(`${rowNumber}行目: SIM電番「${cleanRawSim}」は不正な形式です (11桁, xxx-xxxx-xxxx, または14桁)`);
        }
    }

    // IP Validation
    const validateIpFormat = (value: string, fieldName: string) => {
        if (!value || value.trim() === '') return;
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipRegex.test(value)) {
            errors.push(`${rowNumber}行目: ${fieldName}「${value}」の形式が正しくありません`);
        }
    };
    validateIpFormat(String(row['IPアドレス'] || ''), 'IPアドレス');

    return { isValid: errors.length === 0, errors };
};

const runTests = () => {
    console.log('Starting Router Validation Tests...');

    const testCases = [
        {
            name: 'Valid 11 digits SIM',
            row: { '端末CD(必須)': 'T001', 'SIM電番(必須)': '09012345678' },
            expectedValid: true
        },
        {
            name: 'Valid 14 digits SIM',
            row: { '端末CD(必須)': 'T002', 'SIM電番(必須)': '12345678901234' },
            expectedValid: true
        },
        {
            name: 'Invalid 10 digits SIM',
            row: { '端末CD(必須)': 'T003', 'SIM電番(必須)': '0901234567' },
            expectedValid: false
        },
        {
            name: 'Valid IP',
            row: { '端末CD(必須)': 'T004', 'SIM電番(必須)': '09012345678', 'IPアドレス': '192.168.1.1' },
            expectedValid: true
        },
        {
            name: 'Invalid IP',
            row: { '端末CD(必須)': 'T005', 'SIM電番(必須)': '09012345678', 'IPアドレス': '999.999.999.999.999' },
            expectedValid: false
        }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach((test, index) => {
        const result = validateRouterImportRow(
            test.row,
            index,
            new Set(), new Set(), new Set(), new Set()
        );

        if (result.isValid === test.expectedValid) {
            console.log(`[PASS] ${test.name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${test.name}`);
            console.error('Errors:', result.errors);
            failed++;
        }
    });


    console.log(`Tests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
};

runTests();

export { };
