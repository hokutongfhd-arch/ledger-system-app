'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Tablet } from '../../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { TabletForm } from '../../../../features/devices/components/TabletForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import ExcelJS from 'exceljs';
import { TabletDetailModal } from '../../../../features/devices/components/TabletDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useToast } from '../../../../features/context/ToastContext';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

const statusMap: Record<string, string> = {
    'in-use': '使用中',
    'backup': '予備機',
    'available': '在庫',
    'broken': '故障',
    'repairing': '修理中',
    'discarded': '廃棄',
};

const statusColorMap: Record<string, string> = {
    'in-use': 'bg-green-100 text-green-800',
    'backup': 'bg-purple-100 text-purple-800',
    'available': 'bg-blue-100 text-blue-800',
    'broken': 'bg-red-100 text-red-800',
    'repairing': 'bg-yellow-100 text-yellow-800',
    'discarded': 'bg-gray-100 text-gray-800',
};

const statusSortOrder: Record<string, number> = {
    'in-use': 0, 'backup': 1, 'available': 2, 'broken': 3, 'repairing': 4, 'discarded': 5
};

export default function TabletListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [user, router]);

    if (!user) return null;

    return <TabletListContent />;
}

function TabletListContent() {
    const { tablets, addTablet, updateTablet, deleteTablet, deleteManyTablets, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Tablet | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Tablet | undefined>(undefined);

    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<Tablet>({
        data: tablets,
        searchKeys: ['terminalCode', 'maker', 'modelNumber', 'status', 'addressCode', 'notes'],
        sortConfig: {
            employeeCode: (a, b) => { // User Name Sort
                const nameA = employees.find(e => e.code === a.employeeCode)?.name || '';
                const nameB = employees.find(e => e.code === b.employeeCode)?.name || '';
                return nameA.localeCompare(nameB);
            },
            status: (a, b) => {
                const indexA = statusSortOrder[a.status] ?? 999;
                const indexB = statusSortOrder[b.status] ?? 999;
                return indexA - indexB;
            },
            contractYears: (a, b) => {
                const numA = parseInt(String(a.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }
        }
    });

    const { handleExport } = useCSVExport<Tablet>();
    // Updated headers order
    const headers = [
        '端末CD(必須)', '型番(必須)', 'メーカー', '契約年数', '状況',
        '社員コード', '事業所コード', '負担先', '過去貸与履歴', '備考'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // New format has headers in the 2nd row (index 1)
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
            const { validateTabletImportRow } = await import('../../../../features/devices/device-import-validator');
            let successCount = 0;
            let errorCount = 0;
            const existingTerminalCodes = new Set(tablets.map(t => t.terminalCode));
            const processedTerminalCodes = new Set<string>();
            const errors: string[] = [];
            const reverseStatusMap: Record<string, string> = Object.entries(statusMap).reduce((acc, [key, value]) => {
                acc[value] = key;
                return acc;
            }, {} as Record<string, string>);
            const validStatuses = ['使用中', '予備機', '在庫', '故障', '修理中', '廃棄'];

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

                const validEmployeeCodes = new Set(employees.map(e => e.code));
                const validOfficeCodes = new Set(addresses.map(a => a.addressCode));

                const validation = validateTabletImportRow(
                    rowData,
                    i,
                    existingTerminalCodes,
                    processedTerminalCodes,
                    validEmployeeCodes,
                    validOfficeCodes
                );

                if (!validation.isValid) {
                    errors.push(...validation.errors);
                    continue;
                }

                if (validation.managementNumber) processedTerminalCodes.add(validation.managementNumber);

                const rawStatusAtFile = String(rowData['状況'] || '').trim();
                const employeeCode = String(rowData['社員コード'] || '').trim();
                const addressCode = String(rowData['事業所コード'] || '').trim();

                let finalStatus: any;
                if (employeeCode || addressCode) {
                    finalStatus = 'in-use';
                } else if (rawStatusAtFile === '') {
                    finalStatus = 'available';
                } else {
                    finalStatus = reverseStatusMap[rawStatusAtFile] || 'available';
                }

                const newTablet: Omit<Tablet, 'id'> = {
                    terminalCode: validation.managementNumber || toHalfWidth(String(rowData['端末CD(必須)'] || '')).trim(),
                    maker: String(rowData['メーカー'] || ''),
                    modelNumber: toHalfWidth(String(rowData['型番(必須)'] || '')).trim(),
                    addressCode: addressCode,
                    employeeCode: employeeCode,
                    notes: String(rowData['備考'] || ''),
                    history: String(rowData['過去貸与履歴'] || ''),
                    status: finalStatus,
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    costBearer: String(rowData['負担先'] || ''),
                    address: '',
                };



                importData.push(newTablet);
            }

            // All-or-Nothing check
            if (errors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="font-bold text-red-600 mb-2">エラーが存在するため、インポートを中止しました。</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
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
                    await addTablet(data as Omit<Tablet, 'id'>, true, true);
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
                            <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
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
    const handleEdit = (item: Tablet) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Tablet) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にこのタブレットを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteTablet(item.id, false, false);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件のタブレットを削除しますか？`,
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (confirmed) {
            try {
                await deleteManyTablets(Array.from(selectedIds));
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
            targetType: 'tablet',
            targetId: 'tablet_list',
            result: 'success',
            message: `タブレット一覧のエクスポート: ${filteredData.length}件`
        });

        handleExport(filteredData, headers, `tablet_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.terminalCode || '',
            item.modelNumber || '',
            item.maker || '',
            normalizeContractYear(item.contractYears || ''),
            statusMap[item.status] || item.status,
            item.employeeCode || '',
            item.addressCode || '',
            item.costBearer || '',
            `"${item.history || ''}"`,
            `"${item.notes || ''}"`
        ]);
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Styles
        const fontStyle = { name: 'Yu Gothic' };
        const headerFont1 = { name: 'Yu Gothic', bold: true, size: 16 };
        const headerFont2 = { name: 'Yu Gothic', bold: true, size: 11 };

        // Set column widths and default font FIRST
        worksheet.columns = headers.map(() => ({ width: 20, style: { font: fontStyle } }));

        // --- Row 1: Merged Headers ---
        // Basic Info: A-E (columns 1-5)
        worksheet.mergeCells('A1:E1');
        const cellA1 = worksheet.getCell('A1');
        cellA1.value = '基本情報';
        cellA1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellA1.font = headerFont1;
        cellA1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBE5D6' } // Light Orange
        };

        // User/Place: F-H (columns 6-8)
        worksheet.mergeCells('F1:H1');
        const cellF1 = worksheet.getCell('F1');
        cellF1.value = '使用者・場所';
        cellF1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellF1.font = headerFont1;
        cellF1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2EFDA' } // Light Olive
        };

        // Others: I-J (columns 9-10)
        worksheet.mergeCells('I1:J1');
        const cellI1 = worksheet.getCell('I1');
        cellI1.value = 'その他';
        cellI1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellI1.font = headerFont1;
        cellI1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDDEBF7' } // Light Aqua
        };

        // --- Row 2: Column Headers ---
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(2);

        // Style Row 2
        for (let i = 1; i <= headers.length; i++) {
            const cell = headerRow.getCell(i);
            cell.font = headerFont2;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9D9D9' } // Grey 15%
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
        // Columns Indices (1-based):
        // 1: Terminal CD (Text)
        // 2: Model No (Text)
        // 3: Maker
        // 4: Contract Years
        // 5: Status (Dropdown)
        // 6: Emp Code (Text)
        // 7: Office Code (Text)
        // 8: Cost Bearer
        // 9: History
        // 10: Notes

        // Text Formats: A(1), B(2), F(6), G(7)
        // Added B(2) Model No just in case it's numeric-like
        worksheet.getColumn(1).numFmt = '@';
        worksheet.getColumn(2).numFmt = '@';
        worksheet.getColumn(6).numFmt = '@';
        worksheet.getColumn(7).numFmt = '@';

        // Data Validation (Status dropdown) - column E (index 5)
        for (let i = 3; i <= totalRows + 2; i++) {
            worksheet.getCell(i, 5).dataValidation = {
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
        a.download = 'タブレットエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: Tablet) => isAdmin || user?.code === item.employeeCode;

    const getSortIcon = (key: keyof Tablet | 'userName') => { // Cast for safety
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
    const getRowClassName = (item: Tablet) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">タブレット管理台帳</h1>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted z-10" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            <Table<Tablet>
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

                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('employeeCode')}>使用者{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('addressCode')}>使用事業所{getSortIcon('addressCode')}</div>,
                        accessor: (item) => {
                            const addr = addresses.find(a => a.addressCode === item.addressCode);
                            return addr ? addr.officeName : item.addressCode || '';
                        }
                    },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('status')}>状況{getSortIcon('status')}</div>, accessor: (item) => (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColorMap[item.status] || 'bg-gray-100 text-gray-800'}`}>
                                {statusMap[item.status] || item.status}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'タブレット 編集' : 'タブレット 新規登録'}>
                <TabletForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateTablet({ ...data, id: editingItem.id } as Tablet);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addTablet(data as Omit<Tablet, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <TabletDetailModal
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
