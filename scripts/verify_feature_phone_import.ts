
import ExcelJS from 'exceljs';
import path from 'path';

// Helper functions (Copied/Adapted from page.tsx)
const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
const formatPhoneNumber = (input: string) => {
    const cleaned = input.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{4})(\d{4})$/);
    if (!match) return input;
    return `${match[1]}-${match[2]}-${match[3]}`;
};

const normalizeContractYear = (year: string) => {
    return year.replace(/年/g, '').trim();
};

const verify = async () => {
    const filePath = path.resolve(process.cwd(), 'feature_phone_test.xlsx');
    const workbook = new ExcelJS.Workbook();

    // --- 1. Generate Test Excel File ---
    const worksheet = workbook.addWorksheet('Template');

    const headers = [
        '管理番号(必須)', '電話番号(必須)', '機種名', '契約年数', 'キャリア', '状況',
        '社員コード', '事業所コード', '負担先', '受領書提出日', '貸与日', '返却日', '備考'
    ];

    // Row 1: Merged Headers (Mocking structure)
    worksheet.addRow(['基本情報', '', '', '', '', '', '使用者情報', '', '', '', '', '', 'その他']);
    // Row 2: Headers
    worksheet.addRow(headers);

    // Test Data Rows (Starting Row 3)
    const testRows = [
        // 1. Valid Row
        ['FP-001', '090-1111-1111', 'Galaho1', '2年', 'KDDI', '使用中', '1001', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Valid Note'],
        // 2. Invalid Carrier
        ['FP-002', '090-2222-2222', 'Galaho2', '2', 'INVALID', '使用中', '1002', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Invalid Carrier'],
        // 3. Invalid Status
        ['FP-003', '090-3333-3333', 'Galaho3', '2', 'KDDI', 'INVALID', '1003', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Invalid Status'],
        // 4. Invalid Employee Code (Alpha)
        ['FP-004', '090-4444-4444', 'Galaho4', '2', 'KDDI', '使用中', 'A123', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Invalid Emp Code'],
        // 5. Invalid Office Code (Alpha)
        ['FP-005', '090-5555-5555', 'Galaho5', '2', 'KDDI', '使用中', '1005', 'B999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Invalid Office Code'],
        // 6. Invalid Date Format
        ['FP-006', '090-6666-6666', 'Galaho6', '2', 'KDDI', '使用中', '1006', '9999', 'Comp', '2024.01.01', '2024/01/01', '2024/01/01', 'Invalid Date'],
        // 7. Full-width Management Number (Should Fail strict check if implemented, or warn)
        // Note: The logic converts to half-width, but there is a check `if (/[^\x20-\x7E]/.test(rawManagementNumber))` in page.tsx that errors on full-width.
        ['ＦＰ００７', '090-7777-7777', 'Galaho7', '2', 'KDDI', '使用中', '1007', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Full Width Mgmt No'],
        // 8. Extra Column Data (Column N)
        ['FP-008', '090-8888-8888', 'Galaho8', '2', 'KDDI', '使用中', '1008', '9999', 'Comp', '2024/01/01', '2024/01/01', '2024/01/01', 'Note', 'EXTRA_DATA']
    ];

    testRows.forEach(row => worksheet.addRow(row));

    await workbook.xlsx.writeFile(filePath);
    console.log(`Created ${filePath}`);

    // --- 2. Read and Validate (Simulating useFileImport logic) ---
    console.log("\n--- Starting Verification ---");

    const workbookRead = new ExcelJS.Workbook();
    await workbookRead.xlsx.readFile(filePath);
    const sheet = workbookRead.getWorksheet(1);

    if (!sheet) { console.error("Sheet not found"); return; }

    const rows: any[][] = [];
    const headerRowValues: string[] = [];

    // Simulate reading headers from Row 2 (headerRowIndex = 1)
    sheet.getRow(2).eachCell((cell, colNum) => {
        headerRowValues.push(String(cell.value));
    });

    // Valid Column Count Check (Logic from useFileImport `onValidate`)
    const validColumnCount = headers.length; // 13

    // Simulate iterating rows starting from Row 3
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return;

        // Convert ExcelJS row to array of values, 1-based to 0-based index for logic
        const rowValues: any[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
            // ExcelJS colNum is 1-based.
            // We want index 0 to be Column A.
            rowValues[colNum - 1] = cell.value;
        });

        // Fill empty slots if needed to match length
        for (let k = 0; k < rowValues.length; k++) {
            if (rowValues[k] === undefined) rowValues[k] = '';
        }

        // --- Validation 1: Extra Columns ---
        // Calling the onValidate logic simulation
        if (rowValues.length > validColumnCount) {
            const extraData = rowValues.slice(validColumnCount);
            const hasExtraData = extraData.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '');
            if (hasExtraData) {
                console.log(`Row ${rowNumber}: [Error] 定義された列の外側にデータが存在します (Extra Data: ${extraData})`);
                // In actual app, this returns false and stops import. 
                // We will continue here to verify other rows, but log it.
            }
        }

        rows.push({ rowNumber, data: rowValues });
    });

    // --- Validation 2: Row Content Validation ---
    const existingManagementNumbers = new Set<string>();
    const existingPhoneNumbers = new Set<string>();
    const processedManagementNumbers = new Set<string>();
    const processedPhoneNumbers = new Set<string>();

    const validCarriers = ['KDDI', 'SoftBank', 'Docomo', 'Rakuten', 'その他'];
    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];

    for (const { rowNumber, data } of rows) {
        const errors: string[] = [];
        const rowData: any = {};

        // Map data to headers
        headers.forEach((h, i) => {
            rowData[h] = data[i];
        });

        // Copied Logic from page.tsx (Simulated)
        const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

        let rowHasError = false;
        const rawManagementNumber = String(rowData['管理番号(必須)'] || '');
        const managementNumber = toHalfWidth(rawManagementNumber).trim();

        if (!managementNumber) {
            errors.push(`${rowNumber}行目: 管理番号が空です`);
            rowHasError = true;
        } else {
            if (/[^\x20-\x7E]/.test(rawManagementNumber)) {
                errors.push(`${rowNumber}行目: 管理番号「${rawManagementNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
                rowHasError = true;
            }
        }

        const rawPhoneNumber = String(rowData['電話番号(必須)'] || '');
        const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());

        if (!phoneNumber) {
            errors.push(`${rowNumber}行目: 電話番号が空です`);
            rowHasError = true;
        }

        // Carrier
        const carrier = String(rowData['キャリア'] || '').trim();
        if (carrier && !validCarriers.includes(carrier)) {
            errors.push(`${rowNumber}行目: キャリア「${carrier}」は不正な値です`);
            rowHasError = true;
        }

        // Status
        const statusRaw = String(rowData['状況'] || '').trim();
        if (statusRaw && !validStatuses.includes(statusRaw)) {
            errors.push(`${rowNumber}行目: 状況「${statusRaw}」は不正な値です`);
            rowHasError = true;
        }

        // Employee Code
        const employeeCode = String(rowData['社員コード'] || '').trim();
        if (employeeCode && !/^\d+$/.test(employeeCode)) {
            errors.push(`${rowNumber}行目: 社員コード「${employeeCode}」は半角数字で入力してください`);
            rowHasError = true;
        }

        // Office Code
        const officeCode = String(rowData['事業所コード'] || '').trim();
        if (officeCode && !/^\d+$/.test(officeCode)) {
            errors.push(`${rowNumber}行目: 事業所コード「${officeCode}」は半角数字で入力してください`);
            rowHasError = true;
        }

        // Date Validation
        const isValidDate = (val: any) => {
            if (!val) return true;
            if (typeof val === 'number') return true;
            if (val instanceof Date) return true;
            const str = String(val).trim();
            if (!str) return true;
            return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str);
        };

        if (!isValidDate(rowData['受領書提出日'])) {
            errors.push(`${rowNumber}行目: 受領書提出日は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);
            rowHasError = true;
        }

        if (errors.length > 0) {
            console.log(`Row ${rowNumber}: Found errors:`);
            errors.forEach(e => console.log(`  - ${e}`));
        } else {
            console.log(`Row ${rowNumber}: Valid`);
        }
    }
};

verify().catch(console.error);
