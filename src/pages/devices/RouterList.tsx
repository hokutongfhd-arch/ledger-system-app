import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Table } from '../../components/ui/Table';
import type { Router } from '../../types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DetailModal } from '../../components/ui/DetailModal';
import { RouterForm } from '../../components/forms/RouterForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../utils/stringUtils';

export const RouterList = () => {
    const { routers, addRouter, updateRouter, deleteRouter, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Router | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Router | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        if (window.confirm('本当に削除しますか？')) {
            await deleteRouter(item.id, true);
            await addLog('routers', 'delete', `モバイルルーター削除: ${item.terminalCode} (${item.simNumber})`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm('本当に削除しますか')) {
            try {
                for (const id of selectedIds) {
                    await deleteRouter(id, true);
                }
                await addLog('routers', 'delete', `モバイルルーター一括削除: ${selectedIds.size}件`);
                setSelectedIds(new Set());
                alert('削除しました');
            } catch (error) {
                console.error("Bulk delete failed", error);
                alert('一部の削除に失敗しました');
            }
        }
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
            alert('保存に失敗しました。サーバーが起動しているか確認してください。');
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

    // Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    const handleExportCSV = () => {
        const headers = [
            'No', '請求元', '端末CD', '機種型番', 'キャリア', '費用', '費用振替', '通信容量',
            'SIM電番', 'IPアドレス', 'サブネットマスク', '開始IP', '終了IP', '会社',
            '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考', '返却日', '契約状況', '契約年数'
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
                item.contractYears || ''
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
            '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考(返却日)', '契約状況', '契約年数'
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
                alert('ファイルが空です。');
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                'No.', '請求元', '端末ＣＤ', '機種型番', '通信キャリア', '費用', '費用振替', '通信容量',
                'SIM電番', 'ＩＰアドレス', 'サブネットマスク', '開始ＩＰ', '終了ＩＰ', '会社',
                '住所コード', '実貸与先', '負担先', '実貸与先名', '貸与履歴', '備考(返却日)', '契約状況', '契約年数'
            ];

            const invalidHeaders = headers.filter(h => !requiredHeaders.includes(h));
            if (invalidHeaders.length > 0) {
                alert(`不正な列が含まれています: ${invalidHeaders.join(', ')}\nインポートを中止しました。`);
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
                    alert(`行 ${i + 2} に不正なデータが含まれています (列数が多すぎます)。\nインポートを中止しました。`);
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

            alert(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
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
                        header: '端末CD', accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium whitespace-nowrap"
                            >
                                {item.terminalCode}
                            </button>
                        )
                    },
                    { header: '通信キャリア', accessor: 'carrier' },
                    { header: 'SIM電番', accessor: 'simNumber' },
                    { header: '実貸与先名', accessor: 'actualLenderName' },
                    { header: '契約年数', accessor: 'contractYears' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={hasPermission}
                canDelete={hasPermission}
            />

            {/* Footer with Actions and Pagination */}
            <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 border-t border-gray-200 mt-auto rounded-b-lg gap-4">
                {/* Left: Result Count */}
                <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start">
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                        {totalItems} 件中 {startIndex + 1} - {endIndex} を表示
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Trash2 size={16} />
                        まとめて削除
                    </button>
                </div>

                {/* Right: Pagination Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronsLeft size={20} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex items-center gap-2 mx-2">
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={currentPage}
                                onChange={(e) => handlePageChange(Number(e.target.value))}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                            />
                            <span className="text-sm text-gray-600 whitespace-nowrap">/ {totalPages} ページ</span>
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronsRight size={20} />
                        </button>
                    </div>

                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {[15, 30, 50, 100].map(size => (
                            <option key={size} value={size}>{size} 件 / ページ</option>
                        ))}
                    </select>
                </div>
            </div>

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

            <DetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="モバイルルーター 詳細"
                data={detailItem ? {
                    ...detailItem,
                    notes: detailItem.returnDate
                        ? `${detailItem.notes || ''} (返却日: ${new Date(detailItem.returnDate).toLocaleDateString('ja-JP')})`
                        : detailItem.notes,
                    returnDate: undefined // Hide original returnDate from detailed view as it's merged
                } : undefined}
                labels={{
                    no: 'No.',
                    biller: '請求元',
                    terminalCode: '端末CD',
                    modelNumber: '機種型番',
                    carrier: '通信キャリア',
                    cost: '費用',
                    costTransfer: '費用振替',
                    dataCapacity: '通信容量',
                    simNumber: 'SIM電番',
                    ipAddress: 'IPアドレス',
                    subnetMask: 'サブネットマスク',
                    startIp: '開始IP',
                    endIp: '終了IP',
                    company: '会社',
                    addressCode: '住所コード',
                    actualLender: '実貸与先',
                    costBearer: '負担先',
                    actualLenderName: '実貸与先名',
                    lendingHistory: '貸与履歴',
                    notes: '備考(返却日)',
                    contractStatus: '契約状況',
                    contractYears: '契約年数',
                }}
            />
        </div>
    );
};
