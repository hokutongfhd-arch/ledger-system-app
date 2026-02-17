
import { Employee } from '../employee.types';

export const parseAndValidateEmployees = (
    rows: any[][],
    headers: string[]
): { validEmployees: Employee[]; errors: string[] } => {
    const processedCodes = new Set<string>();
    const importData: Employee[] = [];
    const validationErrors: string[] = [];

    // 1. Parse all rows into Employee objects first
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
        if (isRowEmpty) continue;

        // Adjust row index for error messages (Title + Header + Data)
        // i is 0-based index of data rows.
        // Excel Row = i + 1 (data start) + 1 (header) + 1 (title) = i + 3
        const excelRowNumber = i + 3;

        const rowData: any = {};
        headers.forEach((header, index) => {
            rowData[header] = row[index];
        });

        const toHalfWidth = (str: string) => {
            return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        };

        const rawCode = String(rowData['社員コード(必須)'] || '');
        const code = toHalfWidth(rawCode).trim();

        // Duplicate check within file only
        if (processedCodes.has(code)) {
            // We skip duplicates in file to prevent double-processing same ID twice in one batch
            validationErrors.push(`${excelRowNumber}行目: 社員コード「${code}」がファイル内で重複しています`);
            continue;
        }

        const formatDate = (val: any) => {
            if (!val) return '';
            if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000);
                return date.toISOString().split('T')[0];
            }
            return String(val).trim().replace(/\//g, '-');
        };

        const parseNumber = (val: any) => {
            const parsed = parseInt(String(val || ''));
            return isNaN(parsed) ? 0 : Math.max(0, parsed);
        };

        const birthDateValue = formatDate(rowData['生年月日']);
        const joinDateValue = formatDate(rowData['入社年月日']);

        if (birthDateValue && joinDateValue && new Date(birthDateValue) > new Date(joinDateValue)) {
            validationErrors.push(`${excelRowNumber}行目: 入社年月日（${joinDateValue}）は生年月日（${birthDateValue}）以降である必要があります`);
            continue;
        }

        const lastName = String(rowData['苗字(必須)'] || rowData['氏名'] || '').trim();
        const firstName = String(rowData['名前(必須)'] || '').trim();
        const lastNameKana = String(rowData['苗字カナ'] || rowData['氏名カナ'] || '').trim();
        const firstNameKana = String(rowData['名前カナ'] || '').trim();

        // Validate Name Fields (Block numbers and symbols)
        const nameRegex = /[0-9０-９!-/:-@[-`{-~！-／：-＠［-｀｛-～、。,.?？!！]/;
        const nameFields = [
            { label: '苗字', value: lastName },
            { label: '名前', value: firstName },
            { label: '苗字カナ', value: lastNameKana },
            { label: '名前カナ', value: firstNameKana }
        ];

        for (const field of nameFields) {
            if (field.value && nameRegex.test(field.value)) {
                validationErrors.push(`${excelRowNumber}行目: ${field.label}「${field.value}」に数字または記号が含まれています`);
            }
        }

        const email = String(rowData['メールアドレス(必須)'] || '').trim();
        if (email) {
            if (!/^[\x20-\x7E]+$/.test(email)) {
                validationErrors.push(`${excelRowNumber}行目: メールアドレスに全角文字が含まれています`);
                continue;
            }
            // Validate email format
            if (!/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                validationErrors.push(`${excelRowNumber}行目: メールアドレスの形式が正しくありません`);
                continue;
            }
        }

        const rawPassword = String(rowData['パスワード(必須)'] || '').trim();
        const password = toHalfWidth(rawPassword);

        // Password Validation (8-16 digits, numeric only)
        const passwordErrors = [];
        // Only validate password for new users or if provided
        if (password) {
            if (password.length < 8 || password.length > 16) {
                passwordErrors.push('パスワードは8文字以上16文字以下である必要があります');
            }
            if (!/^[0-9]+$/.test(password)) {
                passwordErrors.push('パスワードは半角数字のみ使用可能です');
            }
        }

        if (passwordErrors.length > 0) {
            passwordErrors.forEach(err => {
                validationErrors.push(`${excelRowNumber}行目: ${err}`);
            });
            continue;
        }

        // スペースを除去し、半角スペースで結合
        const cleanName = `${lastName.replace(/[\s　]+/g, '')} ${firstName.replace(/[\s　]+/g, '')}`.trim();
        const cleanNameKana = `${lastNameKana.replace(/[\s　]+/g, '')} ${firstNameKana.replace(/[\s　]+/g, '')}`.trim();

        const rawRole = String(rowData['権限(必須)'] || '').trim();
        const role = (rawRole === '管理者' || rawRole.toLowerCase() === 'admin') ? 'admin' : 'user';

        if (!rawCode) {
            validationErrors.push(`${excelRowNumber}行目: 社員コード(必須)が未入力です`);
            continue; // Skip creating employee object if ID is missing
        }

        const emp: Omit<Employee, 'id'> & { id?: string } = {
            code: code,
            gender: String(rowData['性別'] || ''),
            name: cleanName,
            nameKana: cleanNameKana,
            birthDate: birthDateValue,
            age: parseNumber(rowData['年齢']),
            areaCode: toHalfWidth(String(rowData['エリアコード'] || '')).trim(),
            addressCode: toHalfWidth(String(rowData['事業所コード'] || '')).trim(),
            joinDate: joinDateValue,
            yearsOfService: parseNumber(rowData['勤続年数']),
            monthsHasuu: parseNumber(rowData['勤続端数月数']),
            role: role,
            password: password,
            companyNo: '',
            departmentCode: '', // Department code removed from import
            email: email
        };

        importData.push(emp as Employee);
        processedCodes.add(code);
    }

    return { validEmployees: importData, errors: validationErrors };
};
