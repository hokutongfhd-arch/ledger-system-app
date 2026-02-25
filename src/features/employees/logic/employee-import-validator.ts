
import { Employee } from '../employee.types';

export const parseAndValidateEmployees = (
    rows: any[][],
    headers: string[]
): { validEmployees: Employee[]; errors: string[] } => {
    const processedCodes = new Set<string>();
    const processedEmails = new Set<string>(); // ファイル内メール重複チェック用
    const importData: Employee[] = [];
    const validationErrors: string[] = [];

    // Helper: Check for full-width characters (considers anything outside ASCII range as full-width roughly, or specifically check range)
    // Requirement says "Full-width characters". Usually means checking for non-half-width-ASCII.
    // ASCII printable: 0x20 - 0x7E.
    const hasFullWidth = (str: string) => /[^\x20-\x7E]/.test(str);

    // Helper: Validate date format
    const isValidDateFormat = (str: string) => {
        if (!str) return true; // Empty check handled separately if required
        // Supported formats: yyyy年mm月dd日, yyyy-mm-dd, yyyy/mm/dd
        // Also check if dates are valid numbers
        const p1 = /^\d{4}年\d{1,2}月\d{1,2}日$/;
        const p2 = /^\d{4}-\d{1,2}-\d{1,2}$/;
        const p3 = /^\d{4}\/\d{1,2}\/\d{1,2}$/;
        return p1.test(str) || p2.test(str) || p3.test(str);
    };

    const parseDate = (val: any): string => {
        if (!val) return '';
        const strVal = String(val).trim();
        // If Excel serial number (although template sets Text format for most, dates might be standard Date)
        if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        // If string, we expect it to matches one of the formats, but we need to normalize to YYYY-MM-DD for storage
        // Format normalization logic:
        let y, m, d;
        if (strVal.includes('年')) {
            const parts = strVal.split(/[年月日]/);
            y = parts[0]; m = parts[1]; d = parts[2];
        } else if (strVal.includes('-')) {
            const parts = strVal.split('-');
            y = parts[0]; m = parts[1]; d = parts[2];
        } else if (strVal.includes('/')) {
            const parts = strVal.split('/');
            y = parts[0]; m = parts[1]; d = parts[2];
        }

        if (y && m && d) {
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return ''; // Should not happen if confirmed valid
    };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
        if (isRowEmpty) continue;

        const excelRowNumber = i + 3;
        const rowData: any = {};
        headers.forEach((header, index) => {
            rowData[header] = row[index];
        });

        let rowHasError = false;

        // 1. Employee Code
        const rawCode = String(rowData['社員コード(必須)'] || '').trim();
        if (!rawCode) {
            validationErrors.push(`${excelRowNumber}行目: 社員コード(必須)が未入力です`);
            rowHasError = true;
        } else {
            if (hasFullWidth(rawCode)) {
                validationErrors.push(`${excelRowNumber}行目: 社員コード「${rawCode}」に全角文字が含まれています`);
                rowHasError = true;
            }
            if (processedCodes.has(rawCode)) {
                validationErrors.push(`${excelRowNumber}行目: 社員コード「${rawCode}」がファイル内で重複しています`);
                rowHasError = true;
            }
        }

        // 2-6. Name / Kana
        const lastName = String(rowData['苗字(必須)'] || rowData['氏名'] || '').trim();
        const firstName = String(rowData['名前(必須)'] || '').trim();
        const lastNameKana = String(rowData['苗字カナ'] || rowData['氏名カナ'] || '').trim();
        const firstNameKana = String(rowData['名前カナ'] || '').trim();

        if (!lastName) { validationErrors.push(`${excelRowNumber}行目: 苗字(必須)が未入力です`); rowHasError = true; }
        if (!firstName) { validationErrors.push(`${excelRowNumber}行目: 名前(必須)が未入力です`); rowHasError = true; }

        // 7. Email
        const email = String(rowData['メールアドレス(必須)'] || '').trim();
        if (email) {
            if (hasFullWidth(email)) {
                validationErrors.push(`${excelRowNumber}行目: メールアドレスに全角文字が含まれています`);
                rowHasError = true;
            } else if (!/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                validationErrors.push(`${excelRowNumber}行目: メールアドレスの形式が正しくありません`);
                rowHasError = true;
            } else if (processedEmails.has(email.toLowerCase())) {
                // ファイル内でメールアドレスが重複している場合
                validationErrors.push(`${excelRowNumber}行目: メールアドレス「${email}」がファイル内で重複しています`);
                rowHasError = true;
            }
        }

        // 8. Birth Date
        const rawBirthDate = rowData['生年月日'];
        let birthDateValue = '';
        if (rawBirthDate || rawBirthDate === 0) {
            // Check formatted string first to validate format if string
            if (typeof rawBirthDate === 'string' && !isValidDateFormat(rawBirthDate)) {
                 validationErrors.push(`${excelRowNumber}行目: 生年月日「${rawBirthDate}」の形式が正しくありません`);
                 rowHasError = true;
            } else {
                birthDateValue = parseDate(rawBirthDate);
            }
        }

        // 9. Age
        const rawAge = String(rowData['年齢'] || '').trim();
        if (rawAge && hasFullWidth(rawAge)) {
            validationErrors.push(`${excelRowNumber}行目: 年齢「${rawAge}」に全角文字が含まれています`);
            rowHasError = true;
        }

        // 10. Area Code
        const rawAreaCode = String(rowData['エリアコード'] || '').trim();
        if (rawAreaCode && hasFullWidth(rawAreaCode)) {
            validationErrors.push(`${excelRowNumber}行目: エリアコード「${rawAreaCode}」に全角文字が含まれています`);
            rowHasError = true;
        }

        // 11. Office Code
        const rawAddressCode = String(rowData['事業所コード'] || '').trim();
        if (rawAddressCode && hasFullWidth(rawAddressCode)) {
            validationErrors.push(`${excelRowNumber}行目: 事業所コード「${rawAddressCode}」に全角文字が含まれています`);
            rowHasError = true;
        }

        // 12. Join Date
        const rawJoinDate = rowData['入社年月日'];
        let joinDateValue = '';
        if (rawJoinDate || rawJoinDate === 0) {
             if (typeof rawJoinDate === 'string' && !isValidDateFormat(rawJoinDate)) {
                validationErrors.push(`${excelRowNumber}行目: 入社年月日「${rawJoinDate}」の形式が正しくありません`);
                rowHasError = true;
             } else {
                joinDateValue = parseDate(rawJoinDate);
             }
        }

        // Cross-field validation for Dates (Birth vs Join)
        // Check both valid before comparing? Or checks at end?
        // Usually logical checks come after format checks.
        // We can do it here if format is valid.
        // const birthDateValue = parseDate(rawBirthDate); // ALREADY PARSED ABOVE
        // const joinDateValue = parseDate(rawJoinDate);   // ALREADY PARSED ABOVE

        if (birthDateValue && joinDateValue && new Date(birthDateValue) > new Date(joinDateValue)) {
            // Message might appear after field specific errors, which is acceptable or expected.
            // If we want it strictly ordered, where does it go? 
            // Usually as a row-level error or associated with Join Date.
            validationErrors.push(`${excelRowNumber}行目: 入社年月日（${joinDateValue}）は生年月日（${birthDateValue}）以降である必要があります`);
            rowHasError = true;
        }

        // 13. Years of Service
        const rawYears = String(rowData['勤続年数'] || '').trim();
        if (rawYears && hasFullWidth(rawYears)) {
            validationErrors.push(`${excelRowNumber}行目: 勤続年数「${rawYears}」に全角文字が含まれています`);
            rowHasError = true;
        }

        // 14. Months of Service
        const rawMonths = String(rowData['勤続端数月数'] || '').trim();
        if (rawMonths && hasFullWidth(rawMonths)) {
            validationErrors.push(`${excelRowNumber}行目: 勤続端数月数「${rawMonths}」に全角文字が含まれています`);
            rowHasError = true;
        }

        // 15. Role
        const rawRole = String(rowData['権限(必須)'] || '').trim();
        if (!rawRole) {
            validationErrors.push(`${excelRowNumber}行目: 権限(必須)が未入力です`);
            rowHasError = true;
        } else if (rawRole !== '管理者' && rawRole !== 'ユーザー') {
            validationErrors.push(`${excelRowNumber}行目: 権限「${rawRole}」は無効な値です`);
            rowHasError = true;
        }
        const role = (rawRole === '管理者') ? 'admin' : 'user';

        // 16. Password
        const rawPassword = String(rowData['パスワード(必須)'] || '').trim();
        const password = rawPassword;
        if (password) {
            if (hasFullWidth(password)) {
                validationErrors.push(`${excelRowNumber}行目: パスワード「${password}」に全角文字が含まれています`);
                rowHasError = true;
            } else if (password.length < 8 || password.length > 16) {
                validationErrors.push(`${excelRowNumber}行目: パスワードは8文字以上16文字以下である必要があります`);
                rowHasError = true;
            } else if (!/^[0-9]+$/.test(password)) {
                validationErrors.push(`${excelRowNumber}行目: パスワードは半角数字のみ使用可能です`);
                rowHasError = true;
            }
        }

        if (rowHasError) continue;

        // Parse Values
        const parseNumber = (val: string) => {
            if (!val) return 0;
            const parsed = parseInt(val.replace(/[^0-9]/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        };

        const cleanName = `${lastName} ${firstName}`.trim();
        const cleanNameKana = `${lastNameKana} ${firstNameKana}`.trim();

        const emp: Omit<Employee, 'id'> & { id?: string } = {
            code: rawCode,
            gender: String(rowData['性別'] || ''),
            name: cleanName,
            nameKana: cleanNameKana,
            birthDate: birthDateValue,
            age: parseNumber(rawAge),
            areaCode: rawAreaCode,
            addressCode: rawAddressCode,
            joinDate: joinDateValue,
            yearsOfService: parseNumber(rawYears),
            monthsHasuu: parseNumber(rawMonths),
            role: role,
            password: password,
            companyNo: '',
            departmentCode: '',
            email: email,
            version: 1,
            updatedAt: '',
        };

        importData.push(emp as Employee);
        processedCodes.add(rawCode);
        if (email) processedEmails.add(email.toLowerCase()); // メール重複チェック用に登録
    }

    return { validEmployees: importData, errors: validationErrors };
};
