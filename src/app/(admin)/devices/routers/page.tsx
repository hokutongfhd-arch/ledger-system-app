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
import { NotificationModal } from '../../../../components/ui/NotificationModal';
import { RouterForm } from '../../../../features/forms/RouterForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import { RouterDetailModal } from '../../../../features/devices/components/RouterDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';

type SortKey = 'terminalCode' | 'carrier' | 'simNumber' | 'actualLenderName' | 'userName' | 'contractYears';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

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
    const { routers, addRouter, updateRouter, deleteRouter, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Router | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Router | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { confirm, ConfirmDialog } = useConfirm();

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: Router) => {
        if (isAdmin) return true;
        return user?.code === item.employeeCode;
    };

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Router) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Router) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当に削除しますか？',
            confirmText: '削除',
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
            description: `選択した ${selectedIds.size} 件を削除しますか？`,
            confirmText: '一括削除',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                for (const id of selectedIds) {
                    await deleteRouter(id, true, true);
                }
                setSelectedIds(new Set());
                await confirm({
                    title: '削除完了',
                    description: '削除しました',
                    confirmText: 'OK',
                    cancelText: ''
                });
            } catch (error) {
                console.error("Bulk delete failed", error);
                await confirm({
                    title: 'エラー',
                    description: '一部の削除に失敗しました',
                    confirmText: 'OK',
                    cancelText: ''
                });
            }
        }
    };

    const sortedData = [...routers].filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = key === 'userName' ? (employees.find(e => e.code === a.employeeCode)?.name || '') : a[key as keyof Router];
            let valB: any = key === 'userName' ? (employees.find(e => e.code === b.employeeCode)?.name || '') : b[key as keyof Router];

            if (key === 'contractYears') {
                const numA = parseInt(String(valA || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB || '').replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) return order === 'asc' ? numA - numB : numB - numA;
            } else if (valA !== valB) {
                return order === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            }
        }
        return 0;
    });

    // データの削除などにより現在のページが無効になった場合に調整する
    useEffect(() => {
        const totalPages = Math.ceil(sortedData.length / pageSize);
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [sortedData.length, pageSize, currentPage]);

    const filteredData = sortedData;
    const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleCheckboxChange = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    };

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    const toggleSort = (key: SortKey) => {
        setSortCriteria(prev => {
            const idx = prev.findIndex(c => c.key === key);
            if (idx === -1) return [...prev, { key, order: 'asc' }];
            if (prev[idx].order === 'asc') {
                const next = [...prev]; next[idx] = { ...next[idx], order: 'desc' }; return next;
            }
            return prev.filter(c => c.key !== key);
        });
    };

    const getSortIcon = (key: SortKey) => {
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

    const handleExportCSV = () => {
        const headers = [
            'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
            '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
            '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
            '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
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
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `router_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
            '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
            '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
            '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'モバイルルーターエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
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
                await confirm({
                    title: 'エラー',
                    description: 'ファイルが空です。',
                    confirmText: 'OK',
                    cancelText: ''
                });
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
                '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
                '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
                '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
            ];

            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: `不足している項目があります: ${missingHeaders.join(', ')}`,
                    confirmText: 'OK',
                    cancelText: ''
                });
                return;
            }

            const rows = jsonData.slice(1);

            // Data bounds validation
            const validColumnCount = requiredHeaders.length;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                // Check for data outside defined columns
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
                        return;
                    }
                }
            }

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                // 行が実質的に空（すべてのセルが空）であるかチェック
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const newRouter: Omit<Router, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    contractStatus: String(rowData['契約状況'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    carrier: String(rowData['通信キャリア'] || ''),
                    modelNumber: String(rowData['機種型番'] || ''),
                    simNumber: String(rowData['SIM電番'] || ''),
                    dataCapacity: String(rowData['通信容量'] || ''),
                    terminalCode: String(rowData['端末CD'] || ''),
                    employeeCode: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
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

            if (successCount > 0) {
                // Manual log removed - covered by DB triggers
            }

            await confirm({
                title: 'インポート完了',
                description: `成功: ${successCount}件\n失敗: ${errorCount}件`,
                confirmText: 'OK',
                cancelText: ''
            });
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">ルーター管理台帳</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" id="fileInput" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
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
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('terminalCode')}>端末CD{getSortIcon('terminalCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.terminalCode}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>通信キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('simNumber')}>SIM電番{getSortIcon('simNumber')}</div>, accessor: 'simNumber' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('actualLenderName')}>実貸与先名{getSortIcon('actualLenderName')}</div>, accessor: 'actualLenderName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: 'contractYears' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={hasPermission}
                canDelete={hasPermission}
            />

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(sortedData.length / pageSize)}
                totalItems={sortedData.length}
                startIndex={(currentPage - 1) * pageSize}
                endIndex={Math.min(currentPage * pageSize, sortedData.length)}
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
