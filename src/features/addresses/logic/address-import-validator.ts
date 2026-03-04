import { Address } from '../../../lib/types';
import { Area } from '../../areas/area.types';
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
    processedCodes: Set<string>,
    existingNames: Set<string>,
    processedNames: Set<string>,
    areaList?: Area[]
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
    let officeCode = toHalfWidth(rawOfficeCode).trim();
    if (!officeCode) {
        errors.push(`${excelRowNumber}行目: 事業所コードが空です`);
        rowHasError = true;
    } else {
        const is6Digits = /^\d{6}$/.test(officeCode);
        const isFormatted = /^\d{4}-\d{2}$/.test(officeCode);

        if (is6Digits) {
            officeCode = `${officeCode.slice(0, 4)}-${officeCode.slice(4)}`;
        } else if (!isFormatted) {
            errors.push(`${excelRowNumber}行目: 事業所コード「${officeCode}」は「xxxx-xx」または「xxxxxx(6桁)」の形式で入力してください`);
            rowHasError = true;
        }

        if (!rowHasError) {
            if (existingCodes.has(officeCode)) {
                errors.push(`${excelRowNumber}行目: 事業所コード「${officeCode}」は既に存在します`);
                rowHasError = true;
            } else if (processedCodes.has(officeCode)) {
                errors.push(`${excelRowNumber}行目: 事業所コード「${officeCode}」がファイル内で重複しています`);
                rowHasError = true;
            }
        }
    }

    // 2. Office Name (事業所名) - Required
    const officeName = String(rowData['事業所名(必須)'] || '').trim();
    if (!officeName) {
        errors.push(`${excelRowNumber}行目: 事業所名が空です`);
        rowHasError = true;
    } else {
        if (existingNames.has(officeName)) {
            errors.push(`${excelRowNumber}行目: 事業所名「${officeName}」は既に存在します`);
            rowHasError = true;
        } else if (processedNames.has(officeName)) {
            errors.push(`${excelRowNumber}行目: 事業所名「${officeName}」がファイル内で重複しています`);
            rowHasError = true;
        }
    }


    // 4. No. - Format
    const no = toHalfWidth(String(rowData['No.'] || '')).trim();
    if (no && !/^[0-9-]+$/.test(no)) {
        errors.push(`${excelRowNumber}行目: No.「${no}」は半角数字とハイフンのみ入力可能です`);
        rowHasError = true;
    }

    // 5. Zip Code (〒) - 任意だが書式チェックあり
    const zip = toHalfWidth(String(rowData['〒'] || '')).trim();
    if (zip) {
        const is7Digits = /^\d{7}$/.test(zip);
        const is34Format = /^\d{3}-\d{4}$/.test(zip);
        if (!is7Digits && !is34Format) {
            errors.push(`${excelRowNumber}行目: 〒「${zip}」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です`);
            rowHasError = true;
        }
    }

    // 6. Address (住所) - 任意
    const address = String(rowData['住所'] || '').trim();

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

    // 9. Area - エリア名を1次ソースとして検索
    const rawAreaInput = toHalfWidth(String(rowData['エリア名'] || '')).trim();
    let resolvedAreaCode = '';
    if (rawAreaInput) {
        if (areaList && areaList.length > 0) {
            // まずエリアコードとして完全一致で探す
            const byCode = areaList.find(a => a.areaCode === rawAreaInput);
            if (byCode) {
                resolvedAreaCode = byCode.areaCode;
            } else {
                // エリア名で探す
                const byName = areaList.find(a => a.areaName === rawAreaInput);
                if (byName) {
                    resolvedAreaCode = byName.areaCode;
                } else {
                    errors.push(`${excelRowNumber}行目: エリア「${rawAreaInput}」はエリアマスタに存在しません`);
                    rowHasError = true;
                }
            }
        } else {
            // areaList が渡されていない場合は値をそのまま使用
            resolvedAreaCode = rawAreaInput;
        }
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
        area: resolvedAreaCode,
        no: no,
        zipCode: formatZipCode(zip || ''),
        address: address,
        tel: tel, // Already strictly validated and formatted
        fax: fax, // Already strictly validated and formatted
        division: String(rowData['事業部'] || ''),
        accountingCode: accountingCode,
        mainPerson: String(rowData['主担当'] || ''),
        branchNumber: branchNumber,
        specialNote: '', // ※列は削除されたため空文字固定
        notes: String(rowData['備考'] || ''),
        labelName: String(rowData['宛名ラベル用'] || ''),
        labelZip: formatZipCode(labelZip || ''),
        labelAddress: String(rowData['宛名ラベル用住所'] || ''),
        attentionNote: String(rowData['注意書き'] || ''),
        type: '',
        version: 1,
        updatedAt: '',
    };

    return { errors, data: newAddress };
};
