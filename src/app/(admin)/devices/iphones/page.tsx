'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { IPhone } from '../../../../features/devices/device.types';
import { Plus, Download, Search, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { IPhoneForm } from '../../../../features/devices/components/IPhoneForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import ExcelJS from 'exceljs';
import { IPhoneDetailModal } from '../../../../features/devices/components/IPhoneDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import { formatPhoneNumber } from '../../../../lib/utils/phoneUtils';
import { useToast } from '../../../../features/context/ToastContext';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

export default function IPhoneListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [user, router]);

    if (!user) return null;

    return <IPhoneListContent />;
}

function IPhoneListContent() {
    const { iPhones, addIPhone, updateIPhone, deleteIPhone, deleteManyIPhones, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const highlightId = searchParams.get('highlight');
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<IPhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<IPhone | undefined>(undefined);

    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<IPhone>({
        data: iPhones,
        searchKeys: ['managementNumber', 'phoneNumber', 'modelName', 'carrier', 'notes'],
        sortConfig: {
            employeeId: (a, b) => { // User Name Sort
                const nameA = employees.find(e => e.code === a.employeeId)?.name || '';
                const nameB = employees.find(e => e.code === b.employeeId)?.name || '';
                return nameA.localeCompare(nameB);
            },
            contractYears: (a, b) => {
                const numA = parseInt(String(a.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }
        }
    });

    const { handleExport } = useCSVExport<IPhone>();
    const headers = [
        '管理番号(必須)', '電話番号(必須)', '機種名', '契約年数', 'キャリア', '状況',
        '社員コード', '事業所コード', '負担先', '受領書提出日', '貸与日', '返却日',
        'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // New format has headers in the 2nd row (index 1)
        onValidate: async (rows, fileHeaders) => {
            // Note: fileHeaders might come from the second row now if the user uses the new template.
            // However, useFileImport typically reads the first row as headers.
            // If the user uses the NEW template, Row 1 is "Basic Info" etc, Row 2 is headers.
            // We need to handle this. But standard CSV/Excel import usually expects headers at Row 1.
            // If we demand users use this specific complex Excel as INPUT, we need to skip Row 1.
            // Let's assume for now the user acts smartly or we stick to checking for these headers in the *detected* headers.
            // Actually, if they upload the Excel, we should tell them to use the headers row.
            // For simplicity in this step, we'll assume the import logic (useFileImport) might need adjustment or we just
            // check if the headers exist.
            // Since useFileImport is a hook, let's see if we can perform a check.
            //
            // Wait, if the user downloads this Excel, fills it, and uploads it, Row 1 will be "Basic Info"...
            // The entries will be shifted.
            //
            // Let's refine the logic inside onValidate/onImport to find the header row if possible,
            // or just guide the user.
            //
            // Re-reading the request: "iPhoneエクセルフォーマットの項目の順番、レイアウトを写真のように修正する"
            // It implies this is for the Template Download.
            //
            // If `useFileImport` reads Xlsx, it typically reads from A1. A1 is now "基本情報".
            // We might need to adjust the import logic to look for the known headers.

            const requiredHeaders = headers;
            // Hacky fix for now: Check if headers match, if not, maybe the headers are in the second row?
            // But `fileHeaders` is passed from the hook.

            // Let's assume standard behavior for now and see if we need to change the hook.

            const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
            if (missingHeaders.length > 0) {
                // Check if it's the new format where headers are in row 2
                // We can't verify row 2 here easily without changing the hook or parsing manually.
                // For now let's rely on column matching if possible or just warn.
                await confirm({
                    title: 'インポートエラー',
                    description: `不足している項目があります: ${missingHeaders.join(', ')}`,
                    confirmText: 'OK',
                    cancelText: ''
                });
                return false;
            }

            const validColumnCount = requiredHeaders.length;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                if (row.length > validColumnCount) {
                    const extraData = row.slice(validColumnCount);
                    const hasExtraData = extraData.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '');
                    if (hasExtraData) {
                        await confirm({
                            title: 'インポートエラー',
                            description: '定義された列の外側にデータが存在します。ファイルを確認してください。',
                            confirmText: 'OK',
                            cancelText: ''
                        });
                        return false;
                    }
                }
            }
            return true;
        },
        onImport: async (rows, fileHeaders) => {
            const { validateDeviceImportRow } = await import('../../../../features/devices/device-import-validator');

            const validationErrors: string[] = [];
            let successCount = 0;
            let errorCount = 0;
            const existingManagementNumbers = new Set(iPhones.map(d => d.managementNumber));
            const existingPhoneNumbers = new Set(iPhones.map(d => d.phoneNumber.replace(/-/g, '')));
            const processedManagementNumbers = new Set<string>();
            const processedPhoneNumbers = new Set<string>();
            const errors: string[] = [];

            const importData: any[] = [];

            const statusMap: Record<string, string> = {
                '使用中': 'in-use',
                '予備機': 'backup',
                '在庫': 'available',
                '故障': 'broken',
                '修理中': 'repairing',
                '廃棄': 'discarded'
            };

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const validation = validateDeviceImportRow(
                    rowData,
                    i,
                    existingPhoneNumbers,
                    processedPhoneNumbers,
                    existingManagementNumbers,
                    processedManagementNumbers
                );

                if (!validation.isValid) {
                    errors.push(...validation.errors);
                    continue;
                }

                // If valid, prepare data object
                const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

                const rawPhoneNumber = String(rowData['電話番号(必須)'] || '');
                const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());

                const rawManagementNumber = String(rowData['管理番号(必須)'] || '');
                const managementNumber = toHalfWidth(rawManagementNumber).trim();

                const formatDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    return String(val).trim().replace(/\//g, '-');
                };

                const formatAddressCode = (code: string) => {
                    const cleanCode = String(code || '').trim();
                    if (cleanCode.length === 6 && /^\d+$/.test(cleanCode)) {
                        return `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`;
                    }
                    return cleanCode;
                };

                const newIPhone: Omit<IPhone, 'id'> & { id?: string } = {
                    managementNumber: managementNumber,
                    phoneNumber: phoneNumber,
                    modelName: String(rowData['機種名'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    carrier: String(rowData['キャリア'] || ''),
                    status: (statusMap[rowData['状況']] || 'available') as any,
                    employeeId: String(rowData['社員コード'] || ''),
                    addressCode: formatAddressCode(rowData['事業所コード']),
                    costBearer: String(rowData['負担先'] || ''),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    lendDate: formatDate(rowData['貸与日']),
                    returnDate: formatDate(rowData['返却日']),
                    smartAddressId: rowData['SMARTアドレス帳ID'] !== undefined && rowData['SMARTアドレス帳ID'] !== null ? String(rowData['SMARTアドレス帳ID']) : '',
                    smartAddressPw: rowData['SMARTアドレス帳PW'] !== undefined && rowData['SMARTアドレス帳PW'] !== null ? String(rowData['SMARTアドレス帳PW']) : '',
                    notes: String(rowData['備考'] || ''),
                    id: rowData['ID'] ? String(rowData['ID']) : undefined,
                };

                if (newIPhone.employeeId && !newIPhone.status) newIPhone.status = 'in-use'; // Only default to in-use if status is missing AND employee exists?
                // Actually user said "Import what is selected".
                // If the user selected "Stock" but assigned an employee, it should be "Stock" (as they requested "correctly imported as selected").
                // If they left it EMPTY, `statusMap` defaults to `available`.
                // If they have employee but no status, maybe `in-use` is better default?
                // But the code `status: (statusMap[rowData['状況']] || 'available')` handles default.
                // The current code forces `in-use` even if `rowData['状況']` was valid.
                // I will simply REMOVE the override.
                // But wait, if they leave Status EMPTY but provide Employee, should it be Available or In Use?
                // Usually In Use.
                // But `statusMap` defaults to `available` if key missing.
                // I should probably allow the passed status to win.
                // I will just remove the line `if (newIPhone.employeeId) newIPhone.status = 'in-use';`.


                importData.push(newIPhone);
                if (validation.managementNumber) processedManagementNumbers.add(validation.managementNumber);
                if (validation.normalizedPhone) processedPhoneNumbers.add(validation.normalizedPhone);
            }

            // All-or-Nothing check
            if (errors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="font-bold text-red-600 mb-2">エラーが存在するため、インポートを中止しました。</p>
                            <ul>{errors.map((err, idx) => <li key={idx} className="text-red-600">{err}</li>)}</ul>
                        </div>
                    ),
                    confirmText: '閉じる',
                    cancelText: ''
                });
                return;
            }

            // Execution Phase
            for (const data of importData) {
                try {
                    await addIPhone(data as Omit<IPhone, 'id'>, true, true);
                    successCount++;
                } catch (error: any) {
                    errors.push(`登録エラー: ${data.managementNumber} - ${error.message || '不明なエラー'}`);
                    errorCount++;
                }
            }

            if (errors.length > 0) {
                await confirm({
                    title: 'インポート結果 (一部スキップ)',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <ul>{errors.map((err, idx) => <li key={idx} className="text-red-600">{err}</li>)}</ul>
                        </div>
                    ),
                    confirmText: 'OK',
                    cancelText: ''
                });
            }

            if (successCount > 0 || errorCount > 0) {
                showToast(`インポート完了 - 成功: ${successCount}件 / 失敗: ${errorCount}件`, errorCount > 0 ? 'warning' : 'success');
            }
        }
    });

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: IPhone) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: IPhone) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にこのiPhoneを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteIPhone(item.id);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件のiPhoneを削除しますか？`,
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (confirmed) {
            try {
                await deleteManyIPhones(Array.from(selectedIds));
                setSelectedIds(new Set());
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleExportCSVClick = async () => {
        // Log the export action
        await logger.log({
            action: 'EXPORT',
            targetType: 'iphone',
            targetId: 'iphone_list',
            result: 'success',
            message: `iPhone一覧のエクスポート: ${filteredData.length}件`
        });

        const statusLabelMap: Record<string, string> = {
            'in-use': '使用中',
            'backup': '予備機',
            'available': '在庫',
            'broken': '故障',
            'repairing': '修理中',
            'discarded': '廃棄'
        };

        handleExport(filteredData, headers, `iphone_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.managementNumber,
            item.phoneNumber,
            item.modelName,
            normalizeContractYear(item.contractYears || ''),
            item.carrier,
            statusLabelMap[item.status] || item.status,
            item.employeeId,
            item.addressCode,
            item.costBearer || '',
            item.receiptDate,
            item.lendDate,
            item.returnDate,
            item.smartAddressId,
            item.smartAddressPw,
            `"${item.notes}"`
        ]);
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Styles
        // Styles
        const fontStyle = { name: 'Yu Gothic' };
        const headerFont1 = { name: 'Yu Gothic', bold: true, size: 16 };
        const headerFont2 = { name: 'Yu Gothic', bold: true, size: 11 };

        // Set column widths and default font FIRST
        // We know we have 15 columns based on headers.length
        worksheet.columns = headers.map(() => ({ width: 20, style: { font: fontStyle } }));

        // --- Row 1: Merged Headers ---
        worksheet.mergeCells('A1:F1');
        const cellA1 = worksheet.getCell('A1');
        cellA1.value = '基本情報';
        cellA1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellA1.font = headerFont1;
        cellA1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBE5D6' } // Light Orange-ish
        };

        worksheet.mergeCells('G1:L1');
        const cellG1 = worksheet.getCell('G1');
        cellG1.value = '使用者情報';
        cellG1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellG1.font = headerFont1;
        cellG1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2EFDA' } // Light Olive/Green-ish
        };

        worksheet.mergeCells('M1:O1');
        const cellM1 = worksheet.getCell('M1');
        cellM1.value = 'その他';
        cellM1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellM1.font = headerFont1;
        cellM1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDDEBF7' } // Light Blue/Aqua-ish
        };

        // --- Row 2: Column Headers ---
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(2);

        // Style Row 2
        // White, Background 1, Darker 15% -> Gray
        for (let i = 1; i <= headers.length; i++) {
            const cell = headerRow.getCell(i);
            cell.font = headerFont2;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9D9D9' } // Grey 15%
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            // Border
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        // Adjust Row Heights
        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 25;

        const totalRows = 1000;

        // Apply Data Validation and Formats
        // We apply this to cells starting from Row 3 to totalRows

        // Text Formats: A(1), B(2), G(7), H(8)
        // Date Formats: J(10), K(11), L(12)
        // Dropdowns: E(5), F(6)

        // It is more efficient to set column properties where possible, but for validation we iterate

        // Column Formats (Entire column except headers potentially, but ExcelJS applies to whole column)
        // We already set default font in global column def. Now set numFmt.
        // Be careful not to overwrite the header font style if we reset the column style.
        // We will modify specific column definitions safely or iterate rows if needed.
        // Actually, setting column.numFmt does not overwrite font if we don't pass style object.

        worksheet.getColumn(1).numFmt = '@'; // Management Number
        worksheet.getColumn(2).numFmt = '@'; // Phone Number
        worksheet.getColumn(7).numFmt = '@'; // Employee Code
        worksheet.getColumn(8).numFmt = '@'; // Office Code

        worksheet.getColumn(10).numFmt = 'yyyy/mm/dd'; // Receipt Date
        worksheet.getColumn(11).numFmt = 'yyyy/mm/dd'; // Lend Date
        worksheet.getColumn(12).numFmt = 'yyyy/mm/dd'; // Return Date

        // Data Validation Loop
        for (let i = 3; i <= totalRows + 2; i++) {
            // Carrier (Column 5 - E)
            worksheet.getCell(i, 5).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"KDDI,SoftBank,Docomo,Rakuten,その他"']
            };

            // Status (Column 6 - F)
            worksheet.getCell(i, 6).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"使用中,予備機,在庫,故障,修理中,廃棄"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'iPhoneエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: IPhone) => isAdmin || user?.code === item.employeeId;

    const getSortIcon = (key: keyof IPhone) => {
        const idx = sortCriteria.findIndex(c => c.key === key);
        if (idx === -1) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
        const c = sortCriteria[idx];
        return (
            <div className="flex items-center gap-0.5 ml-1">
                {c.order === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />}
                {sortCriteria.length > 1 && <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">{idx + 1}</span>}
            </div>
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'in-use': return 'bg-green-100 text-green-700 border-green-200';
            case 'backup': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'available': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'broken': return 'bg-red-100 text-red-700 border-red-200';
            case 'repairing': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'discarded': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-50 text-gray-500 border-gray-100';
        }
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            'in-use': '使用中',
            'backup': '予備機',
            'available': '在庫',
            'broken': '故障',
            'repairing': '修理中',
            'discarded': '廃棄',
        };
        return map[status] || status;
    };

    // Highlight effect
    const getRowClassName = (item: IPhone) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">iPhone 管理台帳</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSVClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    {isAdmin && <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>}
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索 (管理番号, 電話番号...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent outline-none bg-background-subtle text-text-main" />
                </div>
            </div>

            <Table<IPhone>
                containerClassName="max-h-[600px] overflow-auto border-b border-border"
                data={paginatedData}
                rowClassName={getRowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('managementNumber')}>管理番号{getSortIcon('managementNumber')}</div>,
                        accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.managementNumber}</button>
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('modelName')}>機種名{getSortIcon('modelName')}</div>, accessor: 'modelName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('phoneNumber')}>電話番号{getSortIcon('phoneNumber')}</div>, accessor: (item) => formatPhoneNumber(item.phoneNumber) },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('employeeId')}>使用者名{getSortIcon('employeeId')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('lendDate')}>貸与日{getSortIcon('lendDate')}</div>, accessor: 'lendDate' },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('status')}>状況{getSortIcon('status')}</div>,
                        accessor: (item) => (
                            <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                            </span>
                        )
                    },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={hasPermission}
                canDelete={hasPermission}
            />

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredData.length / pageSize)}
                totalItems={filteredData.length}
                startIndex={(currentPage - 1) * pageSize}
                endIndex={Math.min(currentPage * pageSize, filteredData.length)}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
            />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'iPhone 編集' : 'iPhone 新規登録'}>
                <IPhoneForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateIPhone({ ...data, id: editingItem.id } as IPhone);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addIPhone(data as Omit<IPhone, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <IPhoneDetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                item={detailItem}
                employees={employees}
                addresses={addresses}
            />

            <ConfirmDialog />
        </div>
    );
}
