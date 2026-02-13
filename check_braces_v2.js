
const fs = require('fs');

function checkFile(path) {
    try {
        const content = fs.readFileSync(path, 'utf8');
        let open = 0;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '{') {
                open++;
            } else if (char === '}') {
                open--;
            }
        }

        console.log(`File: ${path}`);
        console.log(`Balance: ${open} (Positive means missing }, Negative means extra })`);
    } catch (e) {
        console.error(`Error reading ${path}: ${e.message}`);
    }
}

checkFile('c:/Users/hokuto-marui/ledger-system-app/src/features/addresses/components/AddressForm.tsx');
checkFile('c:/Users/hokuto-marui/ledger-system-app/src/features/areas/components/AreaForm.tsx');
