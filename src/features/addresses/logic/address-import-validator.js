"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAddressImportRow = void 0;
const phoneUtils_1 = require("../../../lib/utils/phoneUtils");
const zipCodeUtils_1 = require("../../../lib/utils/zipCodeUtils");
const validateAddressImportRow = (row, fileHeaders, rowIndex, existingCodes, processedCodes) => {
    const errors = [];
    const rowData = {};
    fileHeaders.forEach((header, index) => {
        rowData[header] = row[index];
    });
    const toHalfWidth = (str) => {
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
    }
    else {
        if (existingCodes.has(code)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${code}」は既に存在します`);
            rowHasError = true;
        }
        else if (processedCodes.has(code)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${code}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }
    const rawAccountingCode = String(rowData['経理コード'] || '');
    const accountingCode = toHalfWidth(rawAccountingCode).trim();
    if (rowHasError) {
        return { errors };
    }
    const newAddress = {
        addressCode: code,
        officeName: String(rowData['事業所名(必須)'] || ''),
        area: String(rowData['エリアコード'] || '').trim(),
        no: String(rowData['No.'] || ''),
        zipCode: (0, zipCodeUtils_1.formatZipCode)(String(rowData['〒(必須)'] || '')),
        address: String(rowData['住所(必須)'] || ''),
        tel: (0, phoneUtils_1.formatPhoneNumber)(String(rowData['TEL'] || '')),
        fax: (0, phoneUtils_1.formatPhoneNumber)(String(rowData['FAX'] || '')),
        division: String(rowData['事業部'] || ''),
        accountingCode: accountingCode,
        mainPerson: String(rowData['主担当'] || ''),
        branchNumber: String(rowData['枝番'] || ''),
        specialNote: String(rowData['※'] || ''),
        notes: String(rowData['備考'] || ''),
        labelName: String(rowData['宛名ラベル用'] || ''),
        labelZip: (0, zipCodeUtils_1.formatZipCode)(String(rowData['宛名ラベル用〒'] || '')),
        labelAddress: String(rowData['宛名ラベル用住所'] || ''),
        attentionNote: String(rowData['注意書き'] || ''),
        type: ''
    };
    return { errors, data: newAddress };
};
exports.validateAddressImportRow = validateAddressImportRow;
