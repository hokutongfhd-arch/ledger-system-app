import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../features/context/DataContext';
import { useAuth } from '../../features/context/AuthContext';
import { Pagination } from '../../components/ui/Pagination';
import { Table } from '../../components/ui/Table';
import type { Tablet } from '../../lib/types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { NotificationModal } from '../../components/ui/NotificationModal';
import { TabletForm } from '../../features/forms/TabletForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../lib/utils/stringUtils';

type SortKey = 'terminalCode' | 'contractYears' | 'status' | 'officeCode' | 'userName';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export const TabletList = () => {
    const { tablets, addTablet, updateTablet, deleteTablet, addLog, employees, addresses } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Tablet | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Tablet | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

    // Notification State
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '通知',
        message: '',
        type: 'alert',
    });

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, isOpen: false }));
    };

    const showNotification = (message: string, type: 'alert' | 'confirm' = 'alert', onConfirm?: () => void, title: string = '通知') => {
        setNotification({
            isOpen: true,
            title,
            message,
            type,
            onConfirm,
        });
    };

    const handleAdd = () => {
        setEditingItem(undefined);
        setIsModalOpen(true);
    };

    // Permission Logic
    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: Tablet) => {
        if (isAdmin) return true;
        // Check if the item belongs to the logged-in user
        // Check if the item belongs to the logged-in user
        return !!(user?.code && item.employeeCode === user.code);
    };

    const handleEdit = (item: Tablet) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: Tablet) => {
        showNotification(
            '本当に削除しますか？',
            'confirm',
            async () => {
                try {
                    await deleteTablet(item.id, true);
                    await addLog('tablets', 'delete', `タブレット削除: ${item.terminalCode} (${item.status})`);
                } catch (error) {
                    console.error(error);
                    showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
                }
            },
            '確認'
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        showNotification(
            '本当に削除しますか',
            'confirm',
            async () => {
                try {
                    // Execute deletions sequentially
                    for (const id of selectedIds) {
                        await deleteTablet(id, true);
                    }
                    await addLog('tablets', 'delete', `タブレット一括削除: ${selectedIds.size}件`);
                    setSelectedIds(new Set());
                    showNotification('削除しました');
                } catch (error) {
                    console.error("Bulk delete failed", error);
                    showNotification('一部の削除に失敗しました', 'alert', undefined, 'エラー');
                }
            },
            '確認'
        );
    };

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
            // Select all current page items
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            // Deselect all current page items
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    };

    const handleSubmit = async (data: Omit<Tablet, 'id'>) => {
        try {
            if (editingItem) {
                await updateTablet({ ...data, id: editingItem.id }, true);
                await addLog('tablets', 'update', `タブレット更新: ${data.terminalCode} (${data.status})`);
                // Check if this was the highlighted item
                if (editingItem.id === searchParams.get('highlight')) {
                    setSearchParams(prev => {
                        const newParams = new URLSearchParams(prev);
                        newParams.delete('highlight');
                        newParams.delete('field');
                        return newParams;
                    }, { replace: true });
                }
            } else {
                await addTablet(data, true);
                await addLog('tablets', 'add', `タブレット新規登録: ${data.terminalCode} (${data.status})`);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showNotification('保存に失敗しました。サーバーが起動しているか確認してください。', 'alert', undefined, 'エラー');
        }
    };

    const getRowClassName = (item: Tablet) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const filteredData = tablets.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const statusSortOrder: Record<string, number> = {
        'in-use': 0,    // 使用中
        'backup': 1,    // 予備機
        'available': 2, // 在庫
        'broken': 3,    // 故障
        'repairing': 4, // 修理中
        'discarded': 5  // 廃棄
    };

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;

            if (key === 'status') {
                const indexA = statusSortOrder[a.status] ?? 999;
                const indexB = statusSortOrder[b.status] ?? 999;
                if (indexA !== indexB) {
                    return order === 'asc' ? indexA - indexB : indexB - indexA;
                }
            } else if (key === 'userName') {
                const valA = employees.find(e => e.code === a.employeeCode)?.name || '';
                const valB = employees.find(e => e.code === b.employeeCode)?.name || '';
                if (valA !== valB) {
                    if (valA < valB) return order === 'asc' ? -1 : 1;
                    if (valA > valB) return order === 'asc' ? 1 : -1;
                }
            } else if (key === 'contractYears') {
                const valA = a[key] || '';
                const valB = b[key] || '';
                const numA = parseInt(valA.replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(valB.replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) {
                    return order === 'asc' ? numA - numB : numB - numA;
                }
            } else {
                const valA = String(a[key as keyof Tablet] || '').toLowerCase();
                const valB = String(b[key as keyof Tablet] || '').toLowerCase();
                if (valA !== valB) {
                    if (valA < valB) return order === 'asc' ? -1 : 1;
                    if (valA > valB) return order === 'asc' ? 1 : -1;
                }
            }
        }
        return 0;
    });

    // Pagination Logic
    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = sortedData.slice(startIndex, endIndex);

    // Check if all items on current page are selected
    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    const toggleSort = (key: SortKey) => {
        setSortCriteria(prev => {
            const existingIndex = prev.findIndex(c => c.key === key);
            if (existingIndex === -1) {
                return [...prev, { key, order: 'asc' }];
            }

            const existing = prev[existingIndex];
            if (existing.order === 'asc') {
                const newCriteria = [...prev];
                newCriteria[existingIndex] = { ...existing, order: 'desc' };
                return newCriteria;
            } else {
                return prev.filter(c => c.key !== key);
            }
        });
    };

    const getSortIcon = (key: SortKey) => {
        const criterionIndex = sortCriteria.findIndex(c => c.key === key);
        if (criterionIndex === -1) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;

        const criterion = sortCriteria[criterionIndex];
        return (
            <div className="flex items-center gap-0.5 ml-1">
                {criterion.order === 'asc'
                    ? <ArrowUp size={14} className="text-blue-600" />
                    : <ArrowDown size={14} className="text-blue-600" />}
                {sortCriteria.length > 1 && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {criterionIndex + 1}
                    </span>
                )}
            </div>
        );
    };

    const handleExportCSV = () => {
        const headers = ['端末CD', 'メーカー', '型番', '事業所CD', '住所コード', '住所', '状況', '備考', '過去貸与履歴', '契約年数', '社員コード'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.terminalCode,
                item.maker,
                item.modelNumber,
                item.officeCode,
                item.addressCode,
                item.address,
                item.status,
                `"${item.notes}"`,
                `"${item.history}"`,
                item.contractYears || '',
                item.employeeCode || ''
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
            '端末ＣＤ', 'メーカー', '型番', '事業所CD', '住所コード', '住所', '備考', '過去貸与履歴', '状況', '契約年数', '社員コード'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '勤怠タブレットエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        document.getElementById('fileInput')?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

            if (jsonData.length === 0) {
                showNotification('ファイルが空です。', 'alert', undefined, 'エラー');
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                '端末ＣＤ', 'メーカー', '型番', '事業所CD', '住所コード', '住所', '備考', '過去貸与履歴', '状況', '契約年数', '社員コード'
            ];

            const invalidHeaders = headers.filter(h => !requiredHeaders.includes(h));
            if (invalidHeaders.length > 0) {
                showNotification(`不正な列が含まれています: ${invalidHeaders.join(', ')}\nインポートを中止しました。`, 'alert', undefined, 'エラー');
                return;
            }

            const rows = jsonData.slice(1);
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                if (row.length > headers.length) {
                    showNotification(`行 ${i + 2} に不正なデータが含まれています (列数が多すぎます)。\nインポートを中止しました。`, 'alert', undefined, 'エラー');
                    return;
                }

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const statusMap: { [key: string]: Tablet['status'] } = {
                    '在庫': 'available',
                    '使用中': 'in-use',
                    '故障': 'broken',
                    '修理中': 'repairing',
                    '廃棄': 'discarded',
                    '予備機': 'backup'
                };

                const newTablet: Omit<Tablet, 'id'> = {
                    terminalCode: String(rowData['端末ＣＤ'] || ''),
                    maker: String(rowData['メーカー'] || ''),
                    modelNumber: String(rowData['型番'] || ''),
                    officeCode: String(rowData['事業所CD'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    address: String(rowData['住所'] || ''),
                    notes: String(rowData['備考'] || ''),
                    history: String(rowData['過去貸与履歴'] || ''),
                    status: statusMap[String(rowData['状況'] || '')] || 'available',
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    employeeCode: String(rowData['社員コード'] || '')
                };

                try {
                    await addTablet(newTablet, true);
                    successCount++;
                } catch (error) {
                    console.error(error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('tablets', 'import', `Excelインポート: ${successCount}件追加`);
            }

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            // Reset file input
            if (e.target) e.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">タブレット管理台帳</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle transition-colors shadow-sm"
                    >
                        <Download size={18} />
                        CSV出力
                    </button>
                    <button
                        onClick={handleDownloadTemplate}
                        className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={18} />
                        フォーマットDL
                    </button>
                    <input
                        type="file"
                        id="fileInput"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={handleImportClick}
                        className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle transition-colors shadow-sm"
                    >
                        <Upload size={18} />
                        インポート
                    </button>
                    <button
                        onClick={handleAdd}
                        className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        新規登録
                    </button>
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="検索 (端末CD, 型番, 状況...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<Tablet>
                containerClassName="max-h-[600px] overflow-auto border-b border-border"
                data={paginatedData}
                rowClassName={getRowClassName}
                columns={[
                    {
                        header: (
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={handleSelectAll}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                        ),
                        accessor: (item) => (
                            <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => handleCheckboxChange(item.id)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                        ),
                        className: "w-10 px-4"
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('terminalCode')}>
                                <span>端末CD</span>
                                {getSortIcon('terminalCode')}
                            </div>
                        ),
                        accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                            >
                                {item.terminalCode}
                            </button>
                        )
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('officeCode')}>
                                <span>事業所CD</span>
                                {getSortIcon('officeCode')}
                            </div>
                        ),
                        accessor: 'officeCode'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('userName')}>
                                <span>使用者名</span>
                                {getSortIcon('userName')}
                            </div>
                        ),
                        accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || ''
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('contractYears')}>
                                <span>契約年数</span>
                                {getSortIcon('contractYears')}
                            </div>
                        ),
                        accessor: 'contractYears'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('status')}>
                                <span>状況</span>
                                {getSortIcon('status')}
                            </div>
                        ),
                        accessor: (item) => (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${item.status === 'available' ? 'bg-blue-100 text-blue-800' :
                                    item.status === 'in-use' ? 'bg-green-100 text-green-800' :
                                        item.status === 'broken' ? 'bg-red-100 text-red-800' :
                                            item.status === 'backup' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                {item.status === 'available' ? '在庫' :
                                    item.status === 'in-use' ? '使用中' :
                                        item.status === 'broken' ? '故障' :
                                            item.status === 'repairing' ? '修理中' :
                                                item.status === 'discarded' ? '廃棄' :
                                                    item.status === 'backup' ? '予備機' : item.status}
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
                totalPages={totalPages}
                totalItems={totalItems}
                startIndex={startIndex}
                endIndex={endIndex}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                }}
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? 'タブレット 編集' : 'タブレット 新規登録'}
            >
                <TabletForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="タブレット 詳細"
            >
                {detailItem && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">端末CD</label>
                                    <div className="text-gray-900">{detailItem.terminalCode}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">メーカー</label>
                                    <div className="text-gray-900">{detailItem.maker || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">型番</label>
                                    <div className="text-gray-900">{detailItem.modelNumber || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">状況</label>
                                    <div className="text-gray-900">
                                        {{
                                            'available': '在庫',
                                            'in-use': '使用中',
                                            'broken': '故障',
                                            'repairing': '修理中',
                                            'discarded': '廃棄',
                                            'backup': '予備機'
                                        }[detailItem.status] || detailItem.status}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">契約年数</label>
                                    <div className="text-gray-900">{detailItem.contractYears || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">場所・使用者</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">社員コード</label>
                                    <div className="text-gray-900">
                                        {detailItem.employeeCode}
                                        {detailItem.employeeCode && (
                                            <span className="ml-2 text-gray-600">
                                                ({employees.find(e => e.code === detailItem.employeeCode)?.name || '未登録'})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所コード</label>
                                    <div className="text-gray-900">
                                        {detailItem.addressCode}
                                        {detailItem.addressCode && (
                                            <span className="ml-2 text-gray-600">
                                                ({addresses.find(a => a.addressCode === detailItem.addressCode)?.officeName || '未登録'})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">事業所CD</label>
                                    <div className="text-gray-900">{detailItem.officeCode || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">過去貸与履歴</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.history || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">備考</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 border-t border-gray-100">
                            <button
                                onClick={() => setDetailItem(undefined)}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type={notification.type}
                onConfirm={notification.onConfirm}
            />
        </div>
    );
};
