import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../features/context/DataContext';
import { useAuth } from '../../features/context/AuthContext';
import { Pagination } from '../../components/ui/Pagination';
import { Table } from '../../components/ui/Table';
import type { Router } from '../../lib/types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { NotificationModal } from '../../components/ui/NotificationModal';
import { RouterForm } from '../../features/forms/RouterForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../lib/utils/stringUtils';

type SortKey = 'terminalCode' | 'carrier' | 'simNumber' | 'actualLenderName' | 'userName' | 'contractYears';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export const RouterList = () => {
    const { routers, addRouter, updateRouter, deleteRouter, addLog, employees, addresses } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Router | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Router | undefined>(undefined);
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
    const hasPermission = (item: Router) => {
        if (isAdmin) return true;
        // Check if the item belongs to the logged-in user
        // Assuming user.name matches actualLenderName
        return !!(user?.name && item.actualLenderName === user.name);
    };

    const handleEdit = (item: Router) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: Router) => {
        showNotification(
            '本当に削除しますか？',
            'confirm',
            async () => {
                try {
                    await deleteRouter(item.id, true);
                    await addLog('routers', 'delete', `モバイルルーター削除: ${item.terminalCode} (${item.simNumber})`);
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
                    for (const id of selectedIds) {
                        await deleteRouter(id, true);
                    }
                    await addLog('routers', 'delete', `モバイルルーター一括削除: ${selectedIds.size}件`);
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
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    };

    const handleSubmit = async (data: Omit<Router, 'id'>) => {
        try {
            if (editingItem) {
                await updateRouter({ ...data, id: editingItem.id }, true);
                await addLog('routers', 'update', `モバイルルーター更新: ${data.terminalCode} (${data.simNumber})`);
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
                await addRouter(data, true);
                await addLog('routers', 'add', `モバイルルーター新規登録: ${data.terminalCode} (${data.simNumber})`);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showNotification('保存に失敗しました。サーバーが起動しているか確認してください。', 'alert', undefined, 'エラー');
        }
    };

    const getRowClassName = (item: Router) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    // Filtering Logic
    const filteredData = routers.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;

            let valA: any;
            let valB: any;

            if (key === 'userName') {
                valA = employees.find(e => e.code === a.employeeCode)?.name || '';
                valB = employees.find(e => e.code === b.employeeCode)?.name || '';
            } else {
                valA = a[key as keyof Router] || '';
                valB = b[key as keyof Router] || '';
            }

            if (key === 'contractYears') {
                const numA = parseInt(String(valA).replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB).replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) {
                    return order === 'asc' ? numA - numB : numB - numA;
                }
            } else if (valA !== valB) {
                if (typeof valA === 'string' && typeof valB === 'string') {
                    if (valA < valB) return order === 'asc' ? -1 : 1;
                    if (valA > valB) return order === 'asc' ? 1 : -1;
                } else {
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
        const headers = [
            'No.', '請求元', '端末CD', '機種型番', '通信キャリア', '費用', '費用振替', '通信容量',
            'SIM電番', 'IPアドレス', 'サブネットマスク', '開始IP', '終了IP', '会社',
            '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考', '返却日', '契約状況', '契約年数', '社員コード'
        ];

        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.no,
                item.biller,
                item.terminalCode,
                item.modelNumber,
                item.carrier,
                item.cost,
                item.costTransfer,
                item.dataCapacity,
                item.simNumber,
                item.ipAddress,
                item.subnetMask,
                item.startIp,
                item.endIp,
                item.company,
                item.addressCode,
                item.actualLender,
                item.costBearer,
                item.actualLenderName,
                `"${item.lendingHistory}"`,
                `"${item.notes}"`,
                item.returnDate,
                item.returnDate,
                item.contractStatus,
                item.contractYears || '',
                item.employeeCode || ''
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
            'No.', '請求元', '端末ＣＤ', '機種型番', '通信キャリア', '費用', '費用振替', '通信容量',
            'SIM電番', 'ＩＰアドレス', 'サブネットマスク', '開始ＩＰ', '終了ＩＰ', '会社',
            '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考(返却日)', '契約状況', '契約年数', '社員コード'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'モバイルルーターエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        document.getElementById('fileInput')?.click();
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
                showNotification('ファイルが空です。', 'alert', undefined, 'エラー');
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                'No.', '請求元', '端末ＣＤ', '機種型番', '通信キャリア', '費用', '費用振替', '通信容量',
                'SIM電番', 'ＩＰアドレス', 'サブネットマスク', '開始ＩＰ', '終了ＩＰ', '会社',
                '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考(返却日)', '契約状況', '契約年数', '社員コード'
            ];

            const invalidHeaders = headers.filter(h => !requiredHeaders.includes(h));
            if (invalidHeaders.length > 0) {
                showNotification(`不正な列が含まれています: ${invalidHeaders.join(', ')}\nインポートを中止しました。`, 'alert', undefined, 'エラー');
                return;
            }

            const rows = jsonData.slice(1);
            let successCount = 0;
            let errorCount = 0;
            let hasError = false;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                if (row.length > headers.length) {
                    showNotification(`行 ${i + 2} に不正なデータが含まれています (列数が多すぎます)。\nインポートを中止しました。`, 'alert', undefined, 'エラー');
                    hasError = true;
                    break;
                }

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const newRouter: Omit<Router, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    biller: String(rowData['請求元'] || ''),
                    terminalCode: String(rowData['端末ＣＤ'] || ''),
                    modelNumber: String(rowData['機種型番'] || ''),
                    carrier: String(rowData['通信キャリア'] || ''),
                    cost: Number(rowData['費用']) || 0,
                    costTransfer: String(rowData['費用振替'] || ''),
                    dataCapacity: String(rowData['通信容量'] || ''),
                    simNumber: String(rowData['SIM電番'] || ''),
                    ipAddress: String(rowData['ＩＰアドレス'] || ''),
                    subnetMask: String(rowData['サブネットマスク'] || ''),
                    startIp: String(rowData['開始ＩＰ'] || ''),
                    endIp: String(rowData['終了ＩＰ'] || ''),
                    company: String(rowData['会社'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    actualLender: String(rowData['実貸与先'] || ''),
                    costBearer: String(rowData['負担先'] || ''),
                    actualLenderName: String(rowData['実貸与先名'] || ''),
                    lendingHistory: String(rowData['貸与履歴'] || ''),
                    notes: String(rowData['備考(返却日)'] || ''),
                    contractStatus: String(rowData['契約状況'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    returnDate: '',
                    employeeCode: String(rowData['社員コード'] || ''),
                };

                try {
                    await addRouter(newRouter, true);
                    successCount++;
                } catch (error) {
                    console.error('Import error for row:', row, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('routers', 'import', `Excelインポート: ${successCount}件追加`);
            }

            if (hasError) return;

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">モバイルルーター管理台帳</h1>
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
                    <button
                        onClick={handleImportClick}
                        className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle transition-colors shadow-sm"
                    >
                        <Upload size={18} />
                        インポート
                    </button>
                    <input
                        type="file"
                        id="fileInput"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleFileChange}
                    />
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
                        placeholder="検索 (管理番号, SIM電番, キャリア...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<Router>
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
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium whitespace-nowrap"
                            >
                                {item.terminalCode}
                            </button>
                        )
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('carrier')}>
                                <span>通信キャリア</span>
                                {getSortIcon('carrier')}
                            </div>
                        ),
                        accessor: 'carrier'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('simNumber')}>
                                <span>SIM電番</span>
                                {getSortIcon('simNumber')}
                            </div>
                        ),
                        accessor: 'simNumber'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('actualLenderName')}>
                                <span>実貸与先名</span>
                                {getSortIcon('actualLenderName')}
                            </div>
                        ),
                        accessor: 'actualLenderName'
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
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={hasPermission}
                canDelete={hasPermission}
            />

            {/* Footer with Actions and Pagination */}
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
                title={editingItem ? 'モバイルルーター 編集' : 'モバイルルーター 新規登録'}
            >
                <RouterForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="モバイルルーター 詳細"
            >
                {detailItem && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">No.</label>
                                    <div className="text-gray-900">{detailItem.no}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">契約状況</label>
                                    <div className="text-gray-900">{detailItem.contractStatus || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">契約年数</label>
                                    <div className="text-gray-900">{detailItem.contractYears || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">通信キャリア</label>
                                    <div className="text-gray-900">{detailItem.carrier || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">機種型番</label>
                                    <div className="text-gray-900">{detailItem.modelNumber || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">SIM電番</label>
                                    <div className="text-gray-900">{detailItem.simNumber || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">通信容量</label>
                                    <div className="text-gray-900">{detailItem.dataCapacity || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">端末CD</label>
                                    <div className="text-gray-900">{detailItem.terminalCode || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
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
                                    <label className="block text-sm font-medium text-gray-500 mb-1">実貸与先</label>
                                    <div className="text-gray-900">{detailItem.actualLender || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">実貸与先名</label>
                                    <div className="text-gray-900">{detailItem.actualLenderName || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">会社</label>
                                    <div className="text-gray-900">{detailItem.company || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">ネットワーク情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">IPアドレス</label>
                                    <div className="text-gray-900">{detailItem.ipAddress || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">サブネットマスク</label>
                                    <div className="text-gray-900">{detailItem.subnetMask || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">開始IP</label>
                                    <div className="text-gray-900">{detailItem.startIp || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">終了IP</label>
                                    <div className="text-gray-900">{detailItem.endIp || '-'}</div>
                                </div>
                            </div>
                        </div>



                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">費用・管理情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">請求元</label>
                                    <div className="text-gray-900">{detailItem.biller || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">費用</label>
                                    <div className="text-gray-900">{detailItem.cost ? detailItem.cost.toLocaleString() : '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">費用振替</label>
                                    <div className="text-gray-900">{detailItem.costTransfer || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">負担先</label>
                                    <div className="text-gray-900">{detailItem.costBearer || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">貸与履歴</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.lendingHistory || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">備考(返却日)</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">
                                        {detailItem.notes || ''}
                                        {detailItem.returnDate ? (detailItem.notes ? `\n(返却日: ${detailItem.returnDate})` : `(返却日: ${detailItem.returnDate})`) : ''}
                                    </div>
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
