
import ExcelJS from 'exceljs';
import path from 'path';

// Helper functions (Copied from page.tsx)
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
    const filePath = path.resolve(process.cwd(), 'import_verification.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // or 'Template'

    if (!worksheet) {
        console.error("Worksheet not found");
        return;
    }

    const rows: any[][] = [];
    const headerRow = worksheet.getRow(2); // Headers are on Row 2
    const fileHeaders: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
        fileHeaders.push(String(cell.value));
    });

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return; // Skip merged header and header row
        const rowData = [];
        // exceljs arrays are 1-based, but our logic in page.tsx loop expects array matching headers?
        // Wait, useFileImport returns `jsonData`. 
        // jsonData is typically array of arrays (if header: false) or array of objects.
        // In page.tsx:
        // const rows = jsonData.slice(headerRowIndex + 1);
        // row is an array of cell values.

        // Let's iterate columns up to header length.
        const rowValues: any[] = [];
        // Map excel row values to array based on header indices
        for (let i = 1; i <= fileHeaders.length; i++) {
            // getCell is 1-based.
            // If headers start at column 1? Yes.
            // But valid data starts at column 1.
            // In exceljs row.values is [empty, val1, val2...] because 1-based.

            // Let's use getCell
            let val = row.getCell(i).value;
            // Date handling in ExcelJS: returns Date object often.
            if (val instanceof Date) {
                // Convert to serial number or keep as Date?
                // Page logic: `typeof val === 'number'` check for serial.
                // Javascript Date object check?
                // The logic in page.tsx: 
                // if (typeof val === 'number') { const date = new Date((val - 25569)...) }
                // if val IS ALREADY Date (ExcelJS default), we need to handle it.
                // But `useFileImport` uses `XLSX.utils.sheet_to_json` with `header: 1`.
                // sheet_to_json returns values using defaults (dateNF etc).
                // It might return numbers or strings depending on options.
                // For this test script, let's treat Dates as strings if they look like strings in input,
                // OR mimic the input `useFileImport` gets.
                // Since we generated strings in `generate_test_excel.ts`, they should come back as strings?
                // ExcelJS might parse '2024/01/01' as Date automatically.
            }
            rowValues.push(val);
        }
        rows.push(rowValues);
    });

    console.log(`Processing ${rows.length} rows...`);

    // Mock existing data
    const existingManagementNumbers = new Set(['EXISTING_MGR']);
    const existingPhoneNumbers = new Set(['09000000000']);
    const processedManagementNumbers = new Set<string>();
    const processedPhoneNumbers = new Set<string>();
    const errors: string[] = [];

    const validCarriers = ['KDDI', 'SoftBank', 'Docomo', 'Rakuten', 'その他'];
    const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const rowData: any = {};
        fileHeaders.forEach((header, index) => {
            rowData[header] = row[index];
        });

        // --- Core Validation Logic (Copied) ---

        const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

        let rowHasError = false;
        const rawManagementNumber = String(rowData['管理番号(必須)'] || '');
        const managementNumber = toHalfWidth(rawManagementNumber).trim();

        if (!managementNumber) {
            errors.push(`${i + 3}行目: 管理番号が空です`); // +3 because of 2 header rows + 1-based
            // Note: In page.tsx it was i + 2 because passed rows started after header.
            // Here rows starts from row 3. i=0 is row 3. So i+3 matches Excel Row Number.
            // page.tsx assumes headerRowIndex (1) -> slice(2) -> rows start from row 3.
            // page.tsx: `errors.push(\`\${i + 2}行目: ...\`)` => i=0 is row 2?
            // Wait. 
            // If headerRowIndex is 1 (Row 2), then data starts at Row 3.
            // rows = jsonData.slice(2).
            // i=0 is Row 3.
            // If page checks `${i + 2}`, it says "2行目". But it's actually 3rd row.
            // The row index logic in page.tsx might be slightly off if it says "i+2".
            // If header is row 2, data is row 3. i=0. i+2 = 2.
            // So it reports Row 2 as error? But Row 2 is header.
            // Actually, `useFileImport` slices `headerRowIndex + 1`.
            // If headerRowIndex=1 (Row 2), slice(2). 
            // Indices: 0(Row1), 1(Row2-Header), 2(Row3-Data).
            // So rows[0] is Row 3.
            // `${i + 2}` means `0 + 2 = 2`.
            // So it reports "2行目" for Row 3. This seems like an off-by-one in the original code? 
            // Or maybe it considers header as row 1?
            // Let's just output the error message as is to see what happens.

            rowHasError = true;
        } else {
            // ... skipping uniqueness check for brevity unless relevant
        }

        const rawPhoneNumber = String(rowData['電話番号(必須)'] || '');
        const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());
        const normalizedPhone = normalizePhone(phoneNumber);

        // ... skipping phone check ...

        // Carrier
        const carrier = String(rowData['キャリア'] || '').trim();
        if (carrier && !validCarriers.includes(carrier)) {
            errors.push(`Row ${i + 3}: キャリア「${carrier}」は不正な値です`);
            rowHasError = true;
        }

        // Status
        const statusRaw = String(rowData['状況'] || '').trim();
        if (statusRaw && !validStatuses.includes(statusRaw)) {
            errors.push(`Row ${i + 3}: 状況「${statusRaw}」は不正な値です`);
            rowHasError = true;
        }

        // Employee Code
        const employeeCode = String(rowData['社員コード'] || '').trim();
        if (employeeCode && !/^\d+$/.test(employeeCode)) {
            errors.push(`Row ${i + 3}: 社員コード「${employeeCode}」は半角数字で入力してください`);
            rowHasError = true;
        }

        // Office Code
        const officeCode = String(rowData['事業所コード'] || '').trim();
        if (officeCode && !/^\d+$/.test(officeCode)) {
            errors.push(`Row ${i + 3}: 事業所コード「${officeCode}」は半角数字で入力してください`);
            rowHasError = true;
        }

        // Date Validation Helper
        const isValidDate = (val: any) => {
            if (!val) return true;
            if (typeof val === 'number') return true;
            if (val instanceof Date) return true; // ExcelJS might return Date
            const str = String(val).trim();
            if (!str) return true;
            // The test data '2024.01.01' will be string
            return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str);
        };

        if (!isValidDate(rowData['受領書提出日'])) {
            // Check value to see what it actually is
            // console.log(`Receipt Date Value: ${rowData['受領書提出日']}`);
            errors.push(`Row ${i + 3}: 受領書提出日は「YYYY-MM-DD」または「YYYY/MM/DD」形式で入力してください`);
            rowHasError = true;
        }

        // ... skipping other dates checks ...

        // Return Date 
        // (Just checking one date should satisfy verification of logic)
    }

    console.log("Validation Errors Found:");
    errors.forEach(e => console.log(e));
};

verify().catch(console.error);
