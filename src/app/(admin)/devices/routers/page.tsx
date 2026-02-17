'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Router } from '../../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { RouterForm } from '../../../../features/devices/components/RouterForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import ExcelJS from 'exceljs';
import { RouterDetailModal } from '../../../../features/devices/components/RouterDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useToast } from '../../../../features/context/ToastContext';
import { formatPhoneNumber, normalizePhoneNumber } from '../../../../lib/utils/phoneUtils';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

export default function RouterListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return <RouterListContent />;
}

function RouterListContent() {
    const { routers, addRouter, updateRouter, deleteRouter, deleteManyRouters, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Router | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Router | undefined>(undefined);

    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<Router>({
        data: routers,
        searchKeys: ['terminalCode', 'carrier', 'simNumber', 'notes'],
        sortConfig: {
            employeeCode: (a, b) => { // User Name Sort
                const nameA = employees.find(e => e.code === a.employeeCode)?.name || '';
                const nameB = employees.find(e => e.code === b.employeeCode)?.name || '';
                return nameA.localeCompare(nameB);
            },
            contractYears: (a, b) => {
                const numA = parseInt(String(a.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }
        }
    });

    const { handleExport } = useCSVExport<Router>();
    const headers = [
        '端末CD(必須)', 'No.', 'SIM電番(必須)', '機種型番', '通信キャリア', '通信容量',
        '契約状況', '契約年数', '状況', '社員コード', '事業所コード',
        'IPアドレス', 'サブネットマスク', '開始IP', '終了IP',
        '請求元', '負担先', '費用', '費用振替', '貸与履歴', '備考(返却日)'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // Header is on the second row
        onValidate: async (rows, fileHeaders) => {
            const requiredHeaders = headers;
            const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
            if (missingHeaders.length > 0) {
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
            let successCount = 0;
            let errorCount = 0;
            const existingTerminalCodes = new Set(routers.map(r => r.terminalCode));
            const existingSimNumbers = new Set(routers.map(r => normalizePhoneNumber(r.simNumber)));
            const processedTerminalCodes = new Set<string>();
            const processedSimNumbers = new Set<string>();
            const errors: string[] = [];

            const importData: any[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                const statusMap: Record<string, string> = {
                    '使用中': 'in-use',
                    '予備機': 'backup',
                    '在庫': 'available',
                    '故障': 'broken',
                    '修理中': 'repairing',
                    '廃棄': 'discarded'
                };

                const rawTerminalCode = String(rowData['端末CD(必須)'] || '');
                let rowHasError = false;

                // Check for full-width characters in Terminal Code
                if (/[^\x20-\x7E]/.test(rawTerminalCode)) {
                    errors.push(`${i + 3}行目: 端末CD「${rawTerminalCode}」に全角文字が含まれています。半角文字のみ使用可能です。`);
                    rowHasError = true;
                }
                const terminalCode = rawTerminalCode.trim();

                if (!terminalCode) {
                    errors.push(`${i + 3}行目: 端末CDが空です`);
                    rowHasError = true;
                } else {
                    if (existingTerminalCodes.has(terminalCode)) {
                        errors.push(`${i + 3}行目: 端末CD「${terminalCode}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedTerminalCodes.has(terminalCode)) {
                        errors.push(`${i + 3}行目: 端末CD「${terminalCode}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                // Check for full-width characters in Model Number
                const rawModelNumber = String(rowData['機種型番'] || '');
                if (/[^\x20-\x7E]/.test(rawModelNumber)) {
                    errors.push(`${i + 3}行目: 機種型番「${rawModelNumber}」に全角文字が含まれています。半角文字のみ使用可能です。`);
                    rowHasError = true;
                }
                const modelNumber = rawModelNumber.trim();

                const rawSimNumber = String(rowData['SIM電番(必須)'] || '');
                const simNumberNormalized = normalizePhoneNumber(rawSimNumber);

                if (simNumberNormalized) {
                    if (existingSimNumbers.has(simNumberNormalized)) {
                        errors.push(`${i + 3}行目: SIM電番「${rawSimNumber}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedSimNumbers.has(simNumberNormalized)) {
                        errors.push(`${i + 3}行目: SIM電番「${rawSimNumber}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                // Network IP Validation
                const validateIpFormat = (value: string, fieldName: string) => {
                    if (!value || value.trim() === '') return;
                    // Regex checks for 4 groups of 1-3 digits separated by dots
                    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
                    if (!ipRegex.test(value)) {
                        errors.push(`${i + 3}行目: ${fieldName}「${value}」の形式が正しくありません (xxx.xxx.xxx.xxx形式、各1-3桁で入力してください)`);
                        rowHasError = true;
                    }
                };

                validateIpFormat(String(rowData['IPアドレス'] || ''), 'IPアドレス');
                validateIpFormat(String(rowData['サブネットマスク'] || ''), 'サブネットマスク');
                validateIpFormat(String(rowData['開始IP'] || ''), '開始IP');
                validateIpFormat(String(rowData['終了IP'] || ''), '終了IP');

                validateIpFormat(String(rowData['終了IP'] || ''), '終了IP');

                // Carrier Validation
                const validCarriers = ['au・wimax2+', 'au', 'docomo(iij)', 'SoftBank'];
                const carrier = String(rowData['通信キャリア'] || '').trim();
                if (carrier && !validCarriers.includes(carrier)) {
                    errors.push(`${i + 3}行目: 通信キャリア「${carrier}」は不正です。プルダウンから選択するか、正しい値を入力してください。(${validCarriers.join(', ')})`);
                    rowHasError = true;
                }

                // Employee Code Validation
                const employeeCode = String(rowData['社員コード'] || '').trim();
                if (employeeCode && !/^[0-9-]+$/.test(employeeCode)) {
                    errors.push(`${i + 3}行目: 社員コード「${employeeCode}」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。`);
                    rowHasError = true;
                }

                // Office Code Validation
                const officeCode = String(rowData['事業所コード'] || '').trim();
                if (officeCode && !/^[0-9-]+$/.test(officeCode)) {
                    errors.push(`${i + 3}行目: 事業所コード「${officeCode}」に不正な文字が含まれています。半角数字とハイフンのみ使用可能です。`);
                    rowHasError = true;
                }

                if (rowHasError) {
                    continue;
                }

                processedTerminalCodes.add(terminalCode);
                if (simNumberNormalized) processedSimNumbers.add(simNumberNormalized);

                const newRouter: Omit<Router, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    contractStatus: String(rowData['契約状況'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    carrier: String(rowData['通信キャリア'] || ''),
                    modelNumber: modelNumber,
                    simNumber: formatPhoneNumber(simNumberNormalized),
                    dataCapacity: String(rowData['通信容量'] || ''),
                    terminalCode: terminalCode,
                    employeeCode: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['事業所コード'] || ''),
                    ipAddress: String(rowData['IPアドレス'] || ''),
                    subnetMask: String(rowData['サブネットマスク'] || ''),
                    startIp: String(rowData['開始IP'] || ''),
                    endIp: String(rowData['終了IP'] || ''),
                    biller: String(rowData['請求元'] || ''),
                    cost: parseInt(String(rowData['費用'] || '').replace(/[^0-9]/g, '')) || 0,
                    costTransfer: String(rowData['費用振替'] || ''),
                    costBearer: String(rowData['負担先'] || ''),
                    lendingHistory: String(rowData['貸与履歴'] || ''),
                    notes: String(rowData['備考(返却日)'] || ''),
                    returnDate: '',
                    status: (statusMap[rowData['状況']] || 'available') as any
                };

                if (newRouter.employeeCode) newRouter.status = 'in-use';

                importData.push(newRouter);
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
                    await addRouter(data as any, true, true);
                    successCount++;
                } catch (error: any) {
                    errors.push(`登録エラー: ${data.terminalCode} - ${error.message || '不明なエラー'}`);
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
    const handleEdit = (item: Router) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Router) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にこのルーターを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteRouter(item.id, false, false);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件のルーターを削除しますか？`,
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (confirmed) {
            try {
                await deleteManyRouters(Array.from(selectedIds));
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
            targetType: 'router',
            targetId: 'router_list',
            result: 'success',
            message: `ルーター一覧のエクスポート: ${filteredData.length}件`
        });

        const statusLabelMap: Record<string, string> = {
            'in-use': '使用中',
            'backup': '予備機',
            'available': '在庫',
            'broken': '故障',
            'repairing': '修理中',
            'discarded': '廃棄'
        };

        handleExport(filteredData, headers, `router_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.terminalCode,
            item.no || '',
            formatPhoneNumber(item.simNumber || ''),
            item.modelNumber || '',
            item.carrier || '',
            item.dataCapacity || '',
            item.contractStatus || '',
            normalizeContractYear(item.contractYears || ''),
            statusLabelMap[item.status] || item.status,
            item.employeeCode || '',
            item.addressCode || '',
            item.ipAddress || '',
            item.subnetMask || '',
            item.startIp || '',
            item.endIp || '',
            item.biller || '',
            item.costBearer || '',
            item.cost || '',
            item.costTransfer || '',
            `"${item.lendingHistory || ''}"`,
            `"${item.notes || ''}"`
        ]);
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Headers
        const topHeader = [
            '基本情報', '', '', '', '', '', '', '', '',
            '使用者・場所', '',
            'ネットワーク情報', '', '', '',
            '費用・管理情報', '', '', '',
            'その他', ''
        ];

        worksheet.addRow(topHeader);
        worksheet.addRow(headers);

        // Merge cells for top header
        worksheet.mergeCells('A1:I1'); // Basic Info
        worksheet.mergeCells('J1:K1'); // User/Place
        worksheet.mergeCells('L1:O1'); // Network
        worksheet.mergeCells('P1:S1'); // Cost/Mgmt
        worksheet.mergeCells('T1:U1'); // Others

        // Styling Top Header (Row 1)
        const topRow = worksheet.getRow(1);
        topRow.height = 30; // 16px font approx
        topRow.font = { name: 'Yu Gothic', bold: true, size: 16 };
        topRow.alignment = { vertical: 'middle', horizontal: 'center' };

        const setCellColor = (colStart: number, colEnd: number, color: string) => {
            for (let c = colStart; c <= colEnd; c++) {
                const cell = worksheet.getCell(1, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        };

        // Apply background colors (approximate ARGB based on "Accent X, White+60%")
        setCellColor(1, 9, 'FFFCE4D6'); // Orange (Basic)
        setCellColor(10, 11, 'FFEBF1DE'); // Olive (User)
        setCellColor(12, 15, 'DCE6F1');   // Aqua (Network) (Standard Light Blue/Aqua)
        setCellColor(16, 19, 'E4DFEC');   // Purple (Cost)
        setCellColor(20, 21, 'F2DCDB');   // Red (Others)

        // Styling Column Headers (Row 2)
        const headerRow = worksheet.getRow(2);
        headerRow.font = { name: 'Yu Gothic', bold: true, size: 11 };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        for (let i = 1; i <= headers.length; i++) {
            const cell = worksheet.getCell(2, i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' } // Gray (Background 1, Black+15% approx)
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        const totalRows = 500;

        // Data Validation
        for (let i = 3; i <= totalRows + 2; i++) {
            // Carrier - Column E (5)
            worksheet.getCell(i, 5).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"au・wimax2+,au,docomo(iij),SoftBank"']
            };

            // Status - Column I (9)
            worksheet.getCell(i, 9).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"使用中,予備機,在庫,故障,修理中,廃棄"']
            };
        }

        // Format numeric columns as text to prevent scientific notation etc.
        // SIM Number (C - 3), Employee Code (J - 10), Office Code (K - 11)
        worksheet.getColumn(3).numFmt = '@';
        worksheet.getColumn(10).numFmt = '@';
        worksheet.getColumn(11).numFmt = '@';
        worksheet.getColumn(1).width = 15; // Terminal CD

        // Set column widths
        worksheet.columns.forEach(col => {
            col.width = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'モバイルルーターエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: Router) => isAdmin || user?.code === item.employeeCode;

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

    const getSortIcon = (key: keyof Router | 'userName') => { // Cast
        const idx = sortCriteria.findIndex(c => c.key === (key === 'userName' ? 'employeeCode' : key));
        if (idx === -1) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
        const c = sortCriteria[idx];
        return (
            <div className="flex items-center gap-0.5 ml-1">
                {c.order === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />}
                {sortCriteria.length > 1 && <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">{idx + 1}</span>}
            </div>
        );
    };

    // Highlight effect
    const getRowClassName = (item: Router) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">ルーター管理台帳</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSVClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                </div>
            </div>

            <Table<Router>
                containerClassName="max-h-[600px] overflow-auto border-b border-border"
                data={paginatedData}
                rowClassName={getRowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('terminalCode')}>端末CD{getSortIcon('terminalCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.terminalCode}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>通信キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('simNumber')}>SIM電番{getSortIcon('simNumber')}</div>, accessor: (item) => formatPhoneNumber(item.simNumber || '') },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('employeeCode')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: (item) => normalizeContractYear(item.contractYears || '') },
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'ルーター 編集' : 'ルーター 新規登録'}>
                <RouterForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateRouter({ ...data, id: editingItem.id } as any);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addRouter(data as any);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <RouterDetailModal
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
