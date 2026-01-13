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
        searchKeys: ['terminalCode', 'carrier', 'simNumber', 'actualLenderName', 'notes'],
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
        'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
        '通信容量', '端末CD', '社員コード', '事業所コード', '実貸与先',
        '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
        '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
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

                const rawTerminalCode = String(rowData['端末CD'] || '');
                const terminalCode = toHalfWidth(rawTerminalCode).trim();
                let rowHasError = false;

                if (!terminalCode) {
                    errors.push(`${i + 2}行目: 端末CDが空です`);
                    rowHasError = true;
                } else {
                    if (existingTerminalCodes.has(terminalCode)) {
                        errors.push(`${i + 2}行目: 端末CD「${terminalCode}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedTerminalCodes.has(terminalCode)) {
                        errors.push(`${i + 2}行目: 端末CD「${terminalCode}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                const rawSimNumber = String(rowData['SIM電番'] || '');
                const simNumberNormalized = normalizePhoneNumber(rawSimNumber);

                if (simNumberNormalized) {
                    if (existingSimNumbers.has(simNumberNormalized)) {
                        errors.push(`${i + 2}行目: SIM電番「${rawSimNumber}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedSimNumbers.has(simNumberNormalized)) {
                        errors.push(`${i + 2}行目: SIM電番「${rawSimNumber}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                if (rowHasError) {
                    errorCount++;
                    continue;
                }

                processedTerminalCodes.add(terminalCode);
                if (simNumberNormalized) processedSimNumbers.add(simNumberNormalized);

                const newRouter: Omit<Router, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    contractStatus: normalizeContractYear(String(rowData['契約状況'] || '')),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    carrier: String(rowData['通信キャリア'] || ''),
                    modelNumber: String(rowData['機種型番'] || ''),
                    simNumber: formatPhoneNumber(simNumberNormalized),
                    dataCapacity: String(rowData['通信容量'] || ''),
                    terminalCode: terminalCode,
                    employeeCode: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['事業所コード'] || ''),
                    actualLender: String(rowData['実貸与先'] || ''),
                    actualLenderName: String(rowData['実貸与先名'] || ''),
                    company: String(rowData['会社'] || ''),
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
                };

                try {
                    await addRouter(newRouter, true, true);
                    successCount++;
                } catch (error) {
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

        handleExport(filteredData, headers, `router_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.no || '',
            item.contractStatus || '',
            item.contractYears || '',
            item.carrier || '',
            item.modelNumber || '',
            item.simNumber || '',
            item.dataCapacity || '',
            item.terminalCode,
            item.employeeCode || '',
            item.addressCode || '',
            item.actualLender || '',
            item.actualLenderName || '',
            item.company || '',
            item.ipAddress || '',
            item.subnetMask || '',
            item.startIp || '',
            item.endIp || '',
            item.biller || '',
            item.cost || '',
            item.costTransfer || '',
            item.costBearer || '',
            `"${item.lendingHistory || ''}"`,
            `"${item.notes || ''}"`
        ]);
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const totalRows = 1000;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows, c: headers.length - 1 } });
        for (let R = 1; R <= totalRows; ++R) {
            const ref = XLSX.utils.encode_cell({ r: R, c: 5 });
            ws[ref] = { t: 's', v: '', z: '@' };
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'モバイルルーターエクセルフォーマット.xlsx');
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: Router) => isAdmin || user?.code === item.employeeCode;

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
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('actualLenderName')}>実貸与先名{getSortIcon('actualLenderName')}</div>, accessor: 'actualLenderName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('employeeCode')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: (item) => normalizeContractYear(item.contractYears || '') },
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
                        await updateRouter({ ...data, id: editingItem.id } as Router);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addRouter(data as Omit<Router, 'id'>);
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
