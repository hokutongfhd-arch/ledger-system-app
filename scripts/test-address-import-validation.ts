
// Mock format utilities
const formatPhoneNumber = (phone: string): string => {
    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.length > 0 && normalized[0] !== '0' && (normalized.length === 10 || normalized.length === 9)) {
        normalized = '0' + normalized;
    }
    if (normalized.length === 11) return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 11)}`;
    if (normalized.length === 10) return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`; // Simplified for test
    return normalized || phone;
};

const formatZipCode = (zip: string): string => {
    const numbers = zip.replace(/[^0-9]/g, '');
    if (numbers.length === 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return zip;
};

const validateAddressImportRow = (
    row: any[],
    fileHeaders: string[],
    rowIndex: number,
    existingCodes: Set<string>,
    processedCodes: Set<string>
): { errors: string[], data?: any } => {
    const errors: string[] = [];
    const rowData: any = {};

    fileHeaders.forEach((header, index) => {
        rowData[header] = row[index];
    });

    const toHalfWidth = (str: string) => {
        return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        });
    };

    // Actual Row Number in Excel (Header 2 rows + 1 based index + rowIndex)
    // rowIndex is 0-based index from the data rows
    const excelRowNumber = rowIndex + 3;

    // Text Format Validation (Half-width numbers and hyphens only)
    let rowHasError = false;
    const textFormatFields = [
        '事業所コード(必須)', 'エリアコード', 'No.',
        '経理コード', 'エリアコード(確認用)', '枝番'
    ];

    for (const field of textFormatFields) {
        const rawValue = String(rowData[field] || '');
        const value = toHalfWidth(rawValue).trim();

        if (value && !/^[0-9-]+$/.test(value)) {
            errors.push(`${excelRowNumber}行目: ${field}「${value}」は半角数字とハイフンのみ入力可能です`);
            rowHasError = true;
        }
    }

    // Phone Number Validation (TEL, FAX)
    // Allowed: 11 digits OR 3-4-4 format (000-0000-0000)
    const phoneFields = ['TEL', 'FAX'];
    for (const field of phoneFields) {
        const rawValue = String(rowData[field] || '');
        const value = toHalfWidth(rawValue).trim();

        if (value) {
            const is11Digits = /^\d{11}$/.test(value);
            const is344Format = /^\d{3}-\d{4}-\d{4}$/.test(value);

            if (!is11Digits && !is344Format) {
                errors.push(`${excelRowNumber}行目: ${field}「${value}」は「xxxxxxxxxxx(11桁)」または「xxx-xxxx-xxxx」の形式のみ入力可能です`);
                rowHasError = true;
            }
        }
    }

    // Zip Code Validation (Zip, LabelZip)
    // Allowed: 7 digits OR 3-4 format (000-0000)
    const zipFields = ['〒(必須)', '宛名ラベル用〒'];
    for (const field of zipFields) {
        const rawValue = String(rowData[field] || '');
        const value = toHalfWidth(rawValue).trim();

        if (value) {
            const is7Digits = /^\d{7}$/.test(value);
            const is34Format = /^\d{3}-\d{4}$/.test(value);

            if (!is7Digits && !is34Format) {
                errors.push(`${excelRowNumber}行目: ${field}「${value}」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です`);
                rowHasError = true;
            }
        }
    }

    // Address Code Check
    const rawCode = String(rowData['事業所コード(必須)'] || '');
    const code = toHalfWidth(rawCode).trim();

    if (!code) {
        errors.push(`${excelRowNumber}行目: 事業所コードが空です`);
        rowHasError = true;
    } else {
        if (existingCodes.has(code)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${code}」は既に存在します`);
            rowHasError = true;
        } else if (processedCodes.has(code)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${code}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }

    const rawAccountingCode = String(rowData['経理コード'] || '');
    const accountingCode = toHalfWidth(rawAccountingCode).trim();

    if (rowHasError) {
        return { errors };
    }

    // Success - omit full object construction for test unless needed
    return { errors: [], data: { addressCode: code, accountingCode } };
};

// Mock Headers
const ADDRESS_IMPORT_HEADERS = [
    '事業所コード(必須)', '事業所名(必須)', 'エリアコード', 'No.',
    '〒(必須)', '住所(必須)', 'TEL', 'FAX',
    '事業部', '経理コード', 'エリアコード(確認用)', '主担当', '枝番', '※', '備考',
    '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '注意書き'
];

interface TestCase {
    name: string;
    description: string;
    row: any[];
    expectedErrors: string[];
}

const testCases: TestCase[] = [
    {
        name: 'Valid Data',
        description: 'All fields are valid.',
        // Code, Name, Area, No, Zip, Addr, Tel, Fax, Div, Acc, Area2, Main, Branch, Note, Label, LabelZip, LabelAddr, Attn
        row: ['001', 'Test Office', '100', '1', '123-4567', 'Tokyo', '090-1234-5678', '090-1234-5678', 'Div1', '1000', '100', 'Person', '1', 'Note', 'Memo', 'Label', '123-4567', 'Addr', 'Attn'],
        expectedErrors: []
    },
    {
        name: 'Invalid Text Format (Alphabet in Code)',
        description: 'Office Code contains alphabet.',
        row: ['A01', 'Test', '', '', '123-4567', 'Addr', '090-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 事業所コード(必須)「A01」は半角数字とハイフンのみ入力可能です']
    },
    {
        name: 'Invalid Phone Format (10 digits)',
        description: 'TEL is 10 digits.',
        row: ['002', 'Test', '', '', '123-4567', 'Addr', '03-1234-567', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: TEL「03-1234-567」は「xxxxxxxxxxx(11桁)」または「xxx-xxxx-xxxx」の形式のみ入力可能です']
    },
    {
        name: 'Invalid Zip Format (Wrong hyphen)',
        description: 'Zip is 3-3-1.',
        row: ['003', 'Test', '', '', '123-456-7', 'Addr', '090-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 〒(必須)「123-456-7」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です']
    },
    {
        name: 'Duplicate Code in DB',
        description: 'Code already exists.',
        row: ['999', 'Test', '', '', '123-4567', 'Addr', '090-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 事業所コード「999」は既に存在します']
    },
    {
        name: 'Duplicate Code in File',
        description: 'Code duplicated in processed list.',
        row: ['888', 'Test', '', '', '123-4567', 'Addr', '090-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 事業所コード「888」がファイル内で重複しています']
    }
];

const runTests = () => {
    console.log('Running Address Import Validation Tests...\n');
    let passedCount = 0;
    let failedCount = 0;

    const existingCodes = new Set(['999']);
    const processedCodes = new Set(['888']);

    testCases.forEach((test, index) => {
        console.log(`Test ${index + 1}: ${test.name}`);
        console.log(`  Description: ${test.description}`);

        // Ensure row length matches headers (pad with undefined/empty)
        while (test.row.length < ADDRESS_IMPORT_HEADERS.length) {
            test.row.push('');
        }

        const result = validateAddressImportRow(test.row, ADDRESS_IMPORT_HEADERS, 0, existingCodes, processedCodes);

        const passed = JSON.stringify(result.errors) === JSON.stringify(test.expectedErrors);

        if (passed) {
            console.log('  Result: PASSED');
            passedCount++;
        } else {
            console.log('  Result: FAILED');
            console.log('  Expected:', test.expectedErrors);
            console.log('  Actual:', result.errors);
            failedCount++;
        }
        console.log('---');
    });

    console.log(`\nSummary: ${passedCount} Passed, ${failedCount} Failed`);
};


runTests();

export { };
