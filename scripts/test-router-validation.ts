
// Mock types and logic from page.tsx to test validation in isolation

interface RouterRow {
    '端末CD(必須)'?: string;
    'No.'?: string;
    'SIM電番(必須)'?: string;
    '機種型番'?: string;
    '通信キャリア'?: string;
    '通信容量'?: string;
    '契約状況'?: string;
    '契約年数'?: string;
    '状況'?: string;
    '社員コード'?: string;
    '事業所コード'?: string;
    'IPアドレス'?: string;
    'サブネットマスク'?: string;
    '開始IP'?: string;
    '終了IP'?: string;
    '請求元'?: string;
    '負担先'?: string;
    '費用'?: string;
    '費用振替'?: string;
    '貸与履歴'?: string;
    '備考(返却日)'?: string;
}

const headers = [
    '端末CD(必須)', 'No.', 'SIM電番(必須)', '機種型番', '通信キャリア', '通信容量',
    '契約状況', '契約年数', '状況', '社員コード', '事業所コード',
    'IPアドレス', 'サブネットマスク', '開始IP', '終了IP',
    '請求元', '負担先', '費用', '費用振替', '貸与履歴', '備考(返却日)'
];

const existingTerminalCodes = new Set(['EXISTING001']);
const existingSimNumbers = new Set(['09012345678']);
const processedTerminalCodes = new Set<string>();
const processedSimNumbers = new Set<string>();

function validateRow(row: RouterRow, i: number): string[] {
    const errors: string[] = [];
    const rowData = row as any;
    let rowHasError = false;

    // --- Logic copied (and adapted) from page.tsx ---

    const rawTerminalCode = String(rowData['端末CD(必須)'] || '');
    // Check for full-width characters in Terminal Code
    if (/[^\x20-\x7E]/.test(rawTerminalCode)) {
        errors.push(`${i + 3}行目: 端末CD「${rawTerminalCode}」に全角文字が含まれています。半角文字のみ使用可能です。`);
        rowHasError = true;
    }
    const terminalCode = rawTerminalCode.trim();

    if (!terminalCode) {
        errors.push(`${i + 3}行目: 端末CDが空です`);
        rowHasError = true;
    } else {
        if (existingTerminalCodes.has(terminalCode)) {
            errors.push(`${i + 3}行目: 端末CD「${terminalCode}」は既に存在します`);
            rowHasError = true;
        } else if (processedTerminalCodes.has(terminalCode)) {
            errors.push(`${i + 3}行目: 端末CD「${terminalCode}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }

    // Check for full-width characters in Model Number
    const rawModelNumber = String(rowData['機種型番'] || '');
    if (/[^\x20-\x7E]/.test(rawModelNumber)) {
        errors.push(`${i + 3}行目: 機種型番「${rawModelNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
        rowHasError = true;
    }

    const rawSimNumber = String(rowData['SIM電番(必須)'] || '');
    // Mock normalizePhoneNumber
    const simNumberNormalized = rawSimNumber.replace(/-/g, '');

    if (simNumberNormalized) {
        if (existingSimNumbers.has(simNumberNormalized)) {
            errors.push(`${i + 3}行目: SIM電番「${rawSimNumber}」は既に存在します`);
            rowHasError = true;
        } else if (processedSimNumbers.has(simNumberNormalized)) {
            errors.push(`${i + 3}行目: SIM電番「${rawSimNumber}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }

    // Network IP Validation
    const validateIpFormat = (value: string, fieldName: string) => {
        if (!value || value.trim() === '') return;
        // Regex checks for 4 groups of 1-3 digits separated by dots
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipRegex.test(value)) {
            errors.push(`${i + 3}行目: ${fieldName}「${value}」の形式が正しくありません (xxx.xxx.xxx.xxx形式、各1-3桁で入力してください)`);
            rowHasError = true;
        }
    };

    validateIpFormat(String(rowData['IPアドレス'] || ''), 'IPアドレス');
    validateIpFormat(String(rowData['サブネットマスク'] || ''), 'サブネットマスク');
    validateIpFormat(String(rowData['開始IP'] || ''), '開始IP');
    validateIpFormat(String(rowData['終了IP'] || ''), '終了IP');

    // Carrier Validation
    const validCarriers = ['au・wimax2+', 'au', 'docomo(iij)', 'SoftBank'];
    const carrier = String(rowData['通信キャリア'] || '').trim();
    if (carrier && !validCarriers.includes(carrier)) {
        errors.push(`${i + 3}行目: 通信キャリア「${carrier}」は不正です。プルダウンから選択するか、正しい値を入力してください。(${validCarriers.join(', ')})`);
        rowHasError = true;
    }

    // Employee Code Validation
    const employeeCode = String(rowData['社員コード'] || '').trim();
    if (employeeCode && !/^[0-9-]+$/.test(employeeCode)) {
        errors.push(`${i + 3}行目: 社員コード「${employeeCode}」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。`);
        rowHasError = true;
    }

    // Office Code Validation
    const officeCode = String(rowData['事業所コード'] || '').trim();
    if (officeCode && !/^[0-9-]+$/.test(officeCode)) {
        errors.push(`${i + 3}行目: 事業所コード「${officeCode}」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。`);
        rowHasError = true;
    }

    // Status Validation
    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];
    const statusValue = String(rowData['状況'] || '').trim();
    if (statusValue && !validStatuses.includes(statusValue)) {
        errors.push(`${i + 3}行目: 状況「${statusValue}」は不正な値です`);
        rowHasError = true;
    }

    if (!rowHasError) {
        processedTerminalCodes.add(terminalCode);
        if (simNumberNormalized) processedSimNumbers.add(simNumberNormalized);
    }

    return errors;
}

// --- Test Cases ---

const testCases: { name: string, input: RouterRow, expectedErrors: string[] }[] = [
    {
        name: "Valid Data",
        input: {
            '端末CD(必須)': 'TEST001',
            'SIM電番(必須)': '080-1111-2222',
            '通信キャリア': 'au',
            '社員コード': '12345',
            '事業所コード': '99-88',
            '状況': '在庫',
            'IPアドレス': '192.168.1.1'
        },
        expectedErrors: []
    },
    {
        name: "Invalid Terminal Code (Full-width)",
        input: {
            '端末CD(必須)': 'ＴＥＳＴ００２', // Full-width
            'SIM電番(必須)': '080-1111-2223'
        },
        expectedErrors: [
            '4行目: 端末CD「ＴＥＳＴ００２」に全角文字が含まれています。半角文字のみ使用可能です。'
        ]
    },
    {
        name: "Invalid Carrier (Not in list)",
        input: {
            '端末CD(必須)': 'TEST003',
            'SIM電番(必須)': '080-1111-2224',
            '通信キャリア': 'UnknownCarrier'
        },
        expectedErrors: [
            '5行目: 通信キャリア「UnknownCarrier」は不正です。プルダウンから選択するか、正しい値を入力してください。(au・wimax2+, au, docomo(iij), SoftBank)'
        ]
    },
    {
        name: "Invalid Employee Code (Non-numeric/hyphen)",
        input: {
            '端末CD(必須)': 'TEST004',
            'SIM電番(必須)': '080-1111-2225',
            '社員コード': 'EMP_001' // Underscore not allowed
        },
        expectedErrors: [
            '6行目: 社員コード「EMP_001」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。'
        ]
    },
    {
        name: "Invalid Office Code (Full-width)",
        input: {
            '端末CD(必須)': 'TEST005',
            'SIM電番(必須)': '080-1111-2226',
            '事業所コード': '１２３' // Full-width
        },
        expectedErrors: [
            '7行目: 事業所コード「１２３」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。'
        ]
    },
    {
        name: "Invalid IP Address (Format)",
        input: {
            '端末CD(必須)': 'TEST006',
            'SIM電番(必須)': '080-1111-2227',
            'IPアドレス': '192.168.1' // Missing octet
        },
        expectedErrors: [
            '8行目: IPアドレス「192.168.1」の形式が正しくありません (xxx.xxx.xxx.xxx形式、各1-3桁で入力してください)'
        ]
    },
    {
        name: "Invalid IP Address (Too many digits)",
        input: {
            '端末CD(必須)': 'TEST007',
            'SIM電番(必須)': '080-1111-2228',
            'サブネットマスク': '255.255.255.9999' // 4 digits
        },
        expectedErrors: [
            '9行目: サブネットマスク「255.255.255.9999」の形式が正しくありません (xxx.xxx.xxx.xxx形式、各1-3桁で入力してください)'
        ]
    },
    {
        name: "Invalid Status",
        input: {
            '端末CD(必須)': 'TEST008',
            'SIM電番(必須)': '080-1111-2229',
            '状況': '不明'
        },
        expectedErrors: [
            '10行目: 状況「不明」は不正な値です'
        ]
    },
    {
        name: "Duplicate within File",
        input: {
            '端末CD(必須)': 'TEST001', // Duplicate of first case
            'SIM電番(必須)': '080-1111-2222' // Duplicate of first case
        },
        expectedErrors: [
            '11行目: 端末CD「TEST001」がファイル内で重複しています',
            '11行目: SIM電番「080-1111-2222」がファイル内で重複しています'
        ]
    }
];

console.log("Starting Validation Tests...\\n");
let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    // Reset processed sets for isolation if needed, but here we want to test file-level duplication
    // Actually for unit testing isolation we might want to clear them, 
    // BUT the last test case "Duplicate within File" depends on state from "Valid Data".
    // So we KEEP the state.

    const rowNumber = index + 1; // 1-based index corresponding to loop
    const errors = validateRow(test.input, rowNumber - 1); // Pass 0-based index to function

    const match = JSON.stringify(errors) === JSON.stringify(test.expectedErrors);

    if (match) {
        console.log(`[PASS] ${test.name}`);
        passed++;
    } else {
        console.log(`[FAIL] ${test.name}`);
        console.log(`  Expected: ${JSON.stringify(test.expectedErrors)}`);
        console.log(`  Actual:   ${JSON.stringify(errors)}`);
        failed++;
    }
});

console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed.`);

export { };
