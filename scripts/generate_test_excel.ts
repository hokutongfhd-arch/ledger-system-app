
import ExcelJS from 'exceljs';
import path from 'path';

const generate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    // Headers (Row 2 based on new format)
    const headers = [
        '管理番号(必須)', '電話番号(必須)', '機種名', '契約年数', 'キャリア', '状況',
        '社員コード', '事業所コード', '負担先', '受領書提出日', '貸与日', '返却日',
        'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
    ];

    // Row 1: Merged Headers (Just visual, but good to match)
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = '基本情報';
    worksheet.mergeCells('G1:L1');
    worksheet.getCell('G1').value = '使用者情報';
    worksheet.mergeCells('M1:O1');
    worksheet.getCell('M1').value = 'その他';

    // Row 2: Headers
    worksheet.getRow(2).values = [null, ...headers]; // 1-based index in ExcelJS often needs check, but addRow handles array correctly. 
    // Actually worksheet.addRow() adds to next available.
    // Let's explicitly set row 2.
    const headerRow = worksheet.getRow(2);
    headers.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
    });

    // Valid Data for base
    const validBase = {
        managementNumber: 'ERROR-TEST',
        phoneNumber: '090-0000-0000',
        model: 'iPhone 13',
        years: '2',
        carrier: 'KDDI',
        status: '使用中',
        empCode: '1107',
        officeCode: '9999',
        bearer: 'Test',
        date: '2024/01/01',
        smartId: 'test',
        smartPw: 'test'
    };

    // Add Error Rows
    const dataRows = [
        // 1. Invalid Carrier
        [
            'ERR-001', '090-1111-1111', 'iPhone', '1',
            'InvalidCarrier', // Error
            '使用中', '1107', '9999', 'Test', '2024/01/01', '2024/01/01', '2024/01/01', 'id', 'pw', 'Invalid Carrier Test'
        ],
        // 2. Invalid Status
        [
            'ERR-002', '090-2222-2222', 'iPhone', '1',
            'KDDI',
            'InvalidStatus', // Error
            '1107', '9999', 'Test', '2024/01/01', '2024/01/01', '2024/01/01', 'id', 'pw', 'Invalid Status Test'
        ],
        // 3. Invalid Employee Code (Non-numeric)
        [
            'ERR-003', '090-3333-3333', 'iPhone', '1',
            'KDDI', '使用中',
            'A123', // Error
            '9999', 'Test', '2024/01/01', '2024/01/01', '2024/01/01', 'id', 'pw', 'Invalid Emp Code Test'
        ],
        // 4. Invalid Office Code (Non-numeric)
        [
            'ERR-004', '090-4444-4444', 'iPhone', '1',
            'KDDI', '使用中',
            '1107',
            'B999', // Error
            'Test', '2024/01/01', '2024/01/01', '2024/01/01', 'id', 'pw', 'Invalid Office Code Test'
        ],
        // 5. Invalid Dates
        [
            'ERR-005', '090-5555-5555', 'iPhone', '1',
            'KDDI', '使用中', '1107', '9999', 'Test',
            '2024.01.01', // Error
            'invalid-date', // Error
            '2024/13/01', // Maybe valid string but logically weird? The regex checks yyyy/mm/dd. 2024/13/01 might fail strictly? regex was /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/ so 13 is allowed by regex but maybe not logic. Let's stick to format error '2024.01.01'
            'id', 'pw', 'Invalid Date Test'
        ]
    ];

    dataRows.forEach(row => {
        worksheet.addRow(row);
    });

    const outputPath = path.resolve(process.cwd(), 'import_verification.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    console.log(`Created ${outputPath}`);
};

generate().catch(console.error);
