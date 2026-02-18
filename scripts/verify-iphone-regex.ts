
const runTests = () => {
    console.log('Verifying iPhone Validation Regex...');

    const employeeCodeRegex = /^[0-9-]+$/;
    const asciiRegex = /[^\x20-\x7E]/; // Returns true if invalid char found

    const testCases = [
        // Employee Code Tests
        { type: 'Employee', input: '12345', expectedValid: true },
        { type: 'Employee', input: '123-456', expectedValid: true },
        { type: 'Employee', input: 'A123', expectedValid: false },
        { type: 'Employee', input: '123_456', expectedValid: false },
        { type: 'Employee', input: '１２３', expectedValid: false }, // Full-width numbers
        { type: 'Employee', input: '123あ', expectedValid: false },

        // SMART ID/PW Tests (Note: Logic is "if matches regex, then INVALID")
        // So expectedValid means !regex.test(input)
        { type: 'SmartID', input: 'user123', expectedValid: true },
        { type: 'SmartID', input: 'PassWord123!', expectedValid: true },
        { type: 'SmartID', input: 'user-name', expectedValid: true },
        { type: 'SmartID', input: 'ｕｓｅｒ', expectedValid: false }, // Full-width
        { type: 'SmartID', input: 'userあ', expectedValid: false },
        { type: 'SmartID', input: ' ', expectedValid: true }, // Space is 0x20, allowed? Yes, 0x20 is in \x20-\x7E
        { type: 'SmartID', input: '　', expectedValid: false }, // Full-width space
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(({ type, input, expectedValid }) => {
        let isValid = false;
        if (type === 'Employee') {
            isValid = employeeCodeRegex.test(input);
        } else {
            isValid = !asciiRegex.test(input);
        }

        if (isValid === expectedValid) {
            console.log(`[PASS] ${type}: "${input}" -> ${isValid}`);
            passed++;
        } else {
            console.error(`[FAIL] ${type}: "${input}" -> ${isValid} (Expected: ${expectedValid})`);
            failed++;
        }
    });

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
};

runTests();
