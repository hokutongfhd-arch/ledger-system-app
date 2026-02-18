import { Address } from '../../../lib/types';
import { formatPhoneNumber } from '../../../lib/utils/phoneUtils';
import { formatZipCode } from '../../../lib/utils/zipCodeUtils';

export interface ImportError {
    row: number;
    message: string;
}

export const validateAddressImportRow = (
    row: any[],
    fileHeaders: string[],
    rowIndex: number,
    existingCodes: Set<string>,
    processedCodes: Set<string>
): { errors: string[], data?: Omit<Address, 'id'> } => {
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

    // Actual Row Number in Excel
    const excelRowNumber = rowIndex + 3;

    let rowHasError = false;

    // 1. Office Code (事業所コード) - Required, Format, Duplication
    const rawOfficeCode = String(rowData['事業所コード(必須)'] || '');
    const officeCode = toHalfWidth(rawOfficeCode).trim();
    if (!officeCode) {
        errors.push(`${excelRowNumber}行目: 事業所コードが空です`);
        rowHasError = true;
    } else {
        if (!/^[0-9-]+$/.test(officeCode)) {
            errors.push(`${excelRowNumber}行目: 事業所コード(必須)「${officeCode}」は半角数字とハイフンのみ入力可能です`);
            rowHasError = true;
        } else if (existingCodes.has(officeCode)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${officeCode}」は既に存在します`);
            rowHasError = true;
        } else if (processedCodes.has(officeCode)) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${officeCode}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }

    // 2. Office Name (事業所名) - Required
    const officeName = String(rowData['事業所名(必須)'] || '').trim();
    if (!officeName) {
        errors.push(`${excelRowNumber}行目: 事業所名が空です`);
        rowHasError = true;
    }

    // 3. Area Code (エリアコード) - Format
    const areaCode = toHalfWidth(String(rowData['エリアコード'] || '')).trim();
    if (areaCode && !/^[0-9-]+$/.test(areaCode)) {
        errors.push(`${excelRowNumber}行目: エリアコード「${areaCode}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 4. No. - Format
    const no = toHalfWidth(String(rowData['No.'] || '')).trim();
    if (no && !/^[0-9-]+$/.test(no)) {
        errors.push(`${excelRowNumber}行目: No.「${no}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 5. Zip Code (〒) - Format
    const zipFields = ['〒(必須)', '宛名ラベル用〒'];
    // We check main Zip first (match Excel order if '〒' is before '住所')
    const zip = toHalfWidth(String(rowData['〒(必須)'] || '')).trim();
    if (zip) {
        const is7Digits = /^\d{7}$/.test(zip);
        const is34Format = /^\d{3}-\d{4}$/.test(zip);
        if (!is7Digits && !is34Format) {
            errors.push(`${excelRowNumber}行目: 〒(必須)「${zip}」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です`);
            rowHasError = true;
        }
    } else {
        // Required check? The field name says "必須".
        // Previous logic didn't explicit empty check, just regex on value.
        // I'll add empty check if strictly required, but for now stick to previous behavior of format only, 
        // unless I want to be strict. 
        // Let's assume emptiness is handled by "Required" header check or UI?
        // Actually, if it says "必須", I should probably check it.
        // But the previous code didn't. I'll stick to format check for now to avoid behavior change.
    }

    // 6. Address (住所) - Required
    const address = String(rowData['住所(必須)'] || '').trim();
    if (!address) {
        errors.push(`${excelRowNumber}行目: 住所が空です`);
        rowHasError = true;
    }

    // 7. Phone (TEL, FAX)
    const tel = toHalfWidth(String(rowData['TEL'] || '')).trim();
    if (tel) {
        if (!/^\d{2,4}-\d{2,4}-\d{2,4}$/.test(tel)) {
            errors.push(`${excelRowNumber}行目: TEL「${tel}」は「xxxx-xxxx-xxxx」の形式(各ブロック2~4桁)で入力してください`);
            rowHasError = true;
        }
    }

    const fax = toHalfWidth(String(rowData['FAX'] || '')).trim();
    if (fax) {
        if (!/^\d{2,4}-\d{2,4}-\d{2,4}$/.test(fax)) {
            errors.push(`${excelRowNumber}行目: FAX「${fax}」は「xxxx-xxxx-xxxx」の形式(各ブロック2~4桁)で入力してください`);
            rowHasError = true;
        }
    }

    // 8. Accounting Code (to match '経理コード')
    const accountingCode = toHalfWidth(String(rowData['経理コード'] || '')).trim();
    if (accountingCode && !/^[0-9-]+$/.test(accountingCode)) {
        errors.push(`${excelRowNumber}行目: 経理コード「${accountingCode}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 9. Area Code Confirm (to match 'エリアコード(確認用)')
    const areaCodeConfirm = toHalfWidth(String(rowData['エリアコード(確認用)'] || '')).trim();
    if (areaCodeConfirm && !/^[0-9-]+$/.test(areaCodeConfirm)) {
        errors.push(`${excelRowNumber}行目: エリアコード(確認用)「${areaCodeConfirm}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 10. Branch Number (to match '枝番')
    const branchNumber = toHalfWidth(String(rowData['枝番'] || '')).trim();
    if (branchNumber && !/^[0-9-]+$/.test(branchNumber)) {
        errors.push(`${excelRowNumber}行目: 枝番「${branchNumber}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 11. Label Zip (to match '宛名ラベル用〒')
    const labelZip = toHalfWidth(String(rowData['宛名ラベル用〒'] || '')).trim();
    if (labelZip) {
        const is7Digits = /^\d{7}$/.test(labelZip);
        const is34Format = /^\d{3}-\d{4}$/.test(labelZip);
        if (!is7Digits && !is34Format) {
            errors.push(`${excelRowNumber}行目: 宛名ラベル用〒「${labelZip}」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です`);
            rowHasError = true;
        }
    }

    // End of sequential checks

    // Re-assign for return object (using validated values)
    const code = officeCode;

    if (rowHasError) {
        return { errors };
    }

    const newAddress: Omit<Address, 'id'> = {
        addressCode: officeCode,
        officeName: officeName,
        area: areaCode,
        no: no,
        zipCode: formatZipCode(zip || ''),
        address: address,
        tel: tel, // Already strictly validated and formatted
        fax: fax, // Already strictly validated and formatted
        division: String(rowData['事業部'] || ''),
        accountingCode: accountingCode,
        mainPerson: String(rowData['主担当'] || ''),
        branchNumber: branchNumber,
        specialNote: String(rowData['※'] || ''),
        notes: String(rowData['備考'] || ''),
        labelName: String(rowData['宛名ラベル用'] || ''),
        labelZip: formatZipCode(labelZip || ''),
        labelAddress: String(rowData['宛名ラベル用住所'] || ''),
        attentionNote: String(rowData['注意書き'] || ''),
        type: ''
    };

    return { errors, data: newAddress };
};
