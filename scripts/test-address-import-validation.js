"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const address_import_validator_1 = require("../src/features/addresses/logic/address-import-validator");
// Mock Headers
const headers = [
    '事業所コード(必須)', '事業所名(必須)', 'エリアコード', 'No.',
    '〒(必須)', '住所(必須)', 'TEL', 'FAX',
    '事業部', '経理コード', 'エリアコード(確認用)', '主担当', '枝番', '※', '備考',
    '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '注意書き'
];
const testCases = [
    {
        name: 'Valid Data',
        description: 'All fields are valid.',
        // Code, Name, Area, No, Zip, Addr, Tel, Fax, Div, Acc, Area2, Main, Branch, Note, Label, LabelZip, LabelAddr, Attn
        row: ['001', 'Test Office', '100', '1', '123-4567', 'Tokyo', '03-1234-5678', '03-1234-5678', 'Div1', '1000', '100', 'Person', '1', 'Note', 'Memo', 'Label', '123-4567', 'Addr', 'Attn'],
        expectedErrors: []
    },
    {
        name: 'Invalid Text Format (Alphabet in Code)',
        description: 'Office Code contains alphabet.',
        row: ['A01', 'Test', '', '', '123-4567', 'Addr', '03-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
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
        row: ['003', 'Test', '', '', '123-456-7', 'Addr', '03-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 〒(必須)「123-456-7」は「xxxxxxx(7桁)」または「xxx-xxxx」の形式のみ入力可能です']
    },
    {
        name: 'Duplicate Code in DB',
        description: 'Code already exists.',
        row: ['999', 'Test', '', '', '123-4567', 'Addr', '03-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
        expectedErrors: ['3行目: 事業所コード「999」は既に存在します']
    },
    {
        name: 'Duplicate Code in File',
        description: 'Code duplicated in processed list.',
        row: ['888', 'Test', '', '', '123-4567', 'Addr', '03-1234-5678', '', '', '', '', '', '', '', '', '', '', '', ''],
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
        while (test.row.length < headers.length) {
            test.row.push('');
        }
        const result = (0, address_import_validator_1.validateAddressImportRow)(test.row, headers, 0, existingCodes, processedCodes);
        const passed = JSON.stringify(result.errors) === JSON.stringify(test.expectedErrors);
        if (passed) {
            console.log('  Result: PASSED');
            passedCount++;
        }
        else {
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
