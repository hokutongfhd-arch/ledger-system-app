import { useRef } from 'react';
import * as XLSX from 'xlsx';

interface UseFileImportProps {
    onImport: (data: any[], headers: string[]) => Promise<void>;
    onValidate?: (data: any[], headers: string[]) => Promise<string[] | boolean>;
}

export const useFileImport = ({ onImport, onValidate }: UseFileImportProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

            if (jsonData.length === 0) {
                // Handle empty file - callback or let parent handle?
                // Ideally we might want a unified error handling callback too
                console.warn('Empty file imported');
                return;
            }

            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1);

            // Preliminary custom validation
            if (onValidate) {
                const validationResult = await onValidate(rows, headers);
                if (validationResult === false || (Array.isArray(validationResult) && validationResult.length > 0)) {
                    // Validation failed, errors handled by callback usually
                    return;
                }
            }

            await onImport(rows, headers);

            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return {
        fileInputRef,
        handleImportClick,
        handleFileChange
    };
};
