'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Tablet } from '../../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { NotificationModal } from '../../../../components/ui/NotificationModal';
import { TabletForm } from '../../../../features/forms/TabletForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import { TabletDetailModal } from '../../../../features/devices/components/TabletDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';

type SortKey = 'terminalCode' | 'contractYears' | 'status' | 'officeCode' | 'userName';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

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

function TabletListContent() {
    const { tablets, addTablet, updateTablet, deleteTablet, addLog, employees, addresses } = useData();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Tablet | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Tablet | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { confirm, ConfirmDialog } = useConfirm();

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Tablet) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Tablet) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当に削除しますか？',
            confirmText: '削除',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteTablet(item.id, false, false);
                await addLog('tablets', 'delete', `タブレット削除: ${item.terminalCode}`);
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
                    await deleteTablet(id, true, true);
                }
                await addLog('tablets', 'delete', `タブレット一括削除: ${selectedIds.size}件`);
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

    const filteredData = tablets.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const statusSortOrder: Record<string, number> = {
        'in-use': 0, 'backup': 1, 'available': 2, 'broken': 3, 'repairing': 4, 'discarded': 5
    };

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            if (key === 'status') {
                const indexA = statusSortOrder[a.status] ?? 999;
                const indexB = statusSortOrder[b.status] ?? 999;
                if (indexA !== indexB) return order === 'asc' ? indexA - indexB : indexB - indexA;
            } else if (key === 'userName') {
                const valA = employees.find(e => e.code === a.employeeCode)?.name || '';
                const valB = employees.find(e => e.code === b.employeeCode)?.name || '';
                if (valA !== valB) return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else if (key === 'contractYears') {
                const numA = parseInt(String(a.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) return order === 'asc' ? numA - numB : numB - numA;
            } else {
                const valA = String(a[key as keyof Tablet] || '').toLowerCase();
                const valB = String(b[key as keyof Tablet] || '').toLowerCase();
                if (valA !== valB) return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
        }
        return 0;
    });

    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

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
            '端末CD', 'メーカー', '型番', '状況', '契約年数',
            '社員コード', '住所コード', '事業所CD', '過去貸与履歴', '備考'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.terminalCode,
                item.maker || '',
                item.modelNumber,
                statusMap[item.status] || item.status,
                item.contractYears || '',
                item.employeeCode || '',
                item.addressCode || '',
                item.officeCode || '',
                `"${item.history || ''}"`,
                `"${item.notes || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tablet_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            '端末CD', 'メーカー', '型番', '状況', '契約年数',
            '社員コード', '住所コード', '事業所CD', '過去貸与履歴', '備考'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'タブレットエクセルフォーマット.xlsx');
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
                '端末CD', 'メーカー', '型番', '状況', '契約年数',
                '社員コード', '住所コード', '事業所CD', '過去貸与履歴', '備考'
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

            const reverseStatusMap: Record<string, string> = Object.entries(statusMap).reduce((acc, [key, value]) => {
                acc[value] = key;
                return acc;
            }, {} as Record<string, string>);

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

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const statusValue = String(rowData['状況'] || '');
                const status = reverseStatusMap[statusValue] || 'available';

                const newTablet: Omit<Tablet, 'id'> = {
                    terminalCode: String(rowData['端末CD'] || ''),
                    maker: String(rowData['メーカー'] || ''),
                    modelNumber: String(rowData['型番'] || ''),
                    status: status as any, // Cast to TabletStatus
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    employeeCode: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    officeCode: String(rowData['事業所CD'] || ''),
                    history: String(rowData['過去貸与履歴'] || ''),
                    notes: String(rowData['備考'] || ''),
                    address: '',
                };

                try {
                    // Skip Toast for individual items in bulk import, but keep Log (or skip log too? Original was skipLog=true. Let's keep strict logging? 
                    // Wait, original code had `addTablet(newTablet, true)`. 
                    // If we want detailed logs for every import item, it will be 100 logs. 
                    // The original code did a SUMMARY log at the end.
                    // So we should KEEP skipLog=true, and ALSO skipToast=true.
                    await addTablet(newTablet, true, true);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('tablets', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
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
                <h1 className="text-2xl font-bold text-text-main">タブレット管理台帳</h1>
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

            <Table<Tablet>
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('terminalCode')}>端末CD{getSortIcon('terminalCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.terminalCode}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('officeCode')}>事業所CD{getSortIcon('officeCode')}</div>, accessor: 'officeCode' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: 'contractYears' },
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
            />

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={startIndex + paginatedData.length}
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
