
import ExcelJS from 'exceljs';
import path from 'path';

// Helper functions
const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

const verify = async () => {
    const filePath = path.resolve(process.cwd(), 'tablet_test.xlsx');
    const workbook = new ExcelJS.Workbook();

    // --- 1. Generate Test Excel File ---
    const worksheet = workbook.addWorksheet('Template');

    // Updated headers based on latest requirement
    const headers = [
        '端末CD(必須)', '型番(必須)', 'メーカー', '契約年数', '状況',
        '社員コード', '事業所コード', '負担先', '過去貸与履歴', '備考'
    ];

    // Row 1: Merged Headers (Mocking structure)
    worksheet.addRow(['基本情報', '', '', '', '', '使用者・場所', '', '', 'その他', '']);
    // Row 2: Headers
    worksheet.addRow(headers);

    // Test Data Rows (Starting Row 3)
    const testRows = [
        // 1. Valid Row
        ['TAB-001', 'iPad Pro', 'Apple', '2年', '使用中', '1001', '9999', 'Comp', 'History', 'Valid Note'],
        // 2. Invalid Status
        ['TAB-002', 'iPad Air', 'Apple', '2', 'INVALID', '1002', '9999', 'Comp', 'History', 'Invalid Status'],
        // 3. Invalid Employee Code (Alpha)
        ['TAB-003', 'Galaxy Tab', 'Samsung', '2', '使用中', 'A123', '9999', 'Comp', 'History', 'Invalid Emp Code'],
        // 4. Invalid Office Code (Alpha)
        ['TAB-004', 'Surface', 'Microsoft', '2', '使用中', '1004', 'B999', 'Comp', 'History', 'Invalid Office Code'],
        // 5. Full-width Terminal Code (Should be error)
        ['ＴＡＢ００５', 'iPad Mini', 'Apple', '2', '使用中', '1005', '9999', 'Comp', 'History', 'Full Width Terminal CD'],
        // 6. Full-width Model Number (Should be error)
        ['TAB-006', 'ｉＰａｄ', 'Apple', '2', '使用中', '1006', '9999', 'Comp', 'History', 'Full Width Model'],
        // 7. Missing Required (Terminal Code)
        ['', 'iPad', 'Apple', '2', '使用中', '1007', '9999', 'Comp', 'History', 'Missing Terminal CD'],
        // 8. Extra Column Data (Column K)
        ['TAB-008', 'iPad', 'Apple', '2', '使用中', '1008', '9999', 'Comp', 'History', 'Valid Note', 'EXTRA_DATA']
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

    // Explicitly define type to avoid implicit any[] error
    const rows: { rowNumber: number; data: any[] }[] = [];

    // Valid Column Count Check (Logic from useFileImport `onValidate`)
    const validColumnCount = headers.length; // 10

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
            }
        }

        rows.push({ rowNumber, data: rowValues });
    });

    // --- Validation 2: Row Content Validation ---
    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];

    for (const { rowNumber, data } of rows) {
        const errors: string[] = [];
        const rowData: any = {};

        // Map data to headers
        headers.forEach((h, i) => {
            rowData[h] = data[i];
        });

        const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

        let rowHasError = false;
        const rawTerminalCode = String(rowData['端末CD(必須)'] || '');
        const terminalCode = toHalfWidth(rawTerminalCode).trim();

        // Check for full-width characters in the original input
        if (/[^\x20-\x7E]/.test(rawTerminalCode)) {
            errors.push(`${rowNumber}行目: 端末CD「${rawTerminalCode}」に全角文字が含まれています。半角文字のみ使用可能です。`);
            rowHasError = true;
        }

        const rawModelNumber = String(rowData['型番(必須)'] || '');
        if (/[^\x20-\x7E]/.test(rawModelNumber)) {
            errors.push(`${rowNumber}行目: 型番「${rawModelNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
            rowHasError = true;
        }

        if (!terminalCode) {
            errors.push(`${rowNumber}行目: 端末CDが空です`);
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

        if (errors.length > 0) {
            console.log(`Row ${rowNumber}: Found errors:`);
            errors.forEach(e => console.log(`  - ${e}`));
        } else {
            console.log(`Row ${rowNumber}: Valid`);
        }
    }
};

verify().catch(console.error);
