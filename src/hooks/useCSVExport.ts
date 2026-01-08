
export const useCSVExport = <T extends any>() => {
    const handleExport = (
        data: T[],
        headers: string[],
        filename: string,
        transform: (item: T) => (string | number | null | undefined)[]
    ) => {
        const csvContent = [
            headers.join(','),
            ...data.map(item => {
                const row = transform(item);
                return row.map(val => {
                    if (val === null || val === undefined) return '';
                    const strVal = String(val);
                    // Create proper CSV escaping
                    if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                        return `"${strVal.replace(/"/g, '""')}"`;
                    }
                    return strVal;
                }).join(',');
            })
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return { handleExport };
};
