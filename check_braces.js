
const fs = require('fs');

function checkFile(path) {
    const content = fs.readFileSync(path, 'utf8');
    let open = 0;
    let stack = [];

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '{') {
            open++;
            stack.push(i);
        } else if (char === '}') {
            open--;
            stack.pop();
        }
    }

    console.log(`File: ${path}`);
    console.log(`Balance: ${open} (Positive means missing }, Negative means extra })`);
}

checkFile('c:\\Users\\hokuto-marui\\ledger-system-app\\src\\features\\addresses\\components\\AddressForm.tsx');
checkFile('c:\\Users\\hokuto-marui\\ledger-system-app\\src\\features\\areas\\components\\AreaForm.tsx');
