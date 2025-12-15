import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Table } from '../../components/ui/Table';
import type { FeaturePhone } from '../../types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DetailModal } from '../../components/ui/DetailModal';
import { FeaturePhoneForm } from '../../components/forms/FeaturePhoneForm';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

export const FeaturePhoneList = () => {
    const { featurePhones, addFeaturePhone, updateFeaturePhone, deleteFeaturePhone, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FeaturePhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<FeaturePhone | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { user } = useAuth();

    const handleAdd = () => {
        setEditingItem(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (item: FeaturePhone) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: FeaturePhone) => {
        if (window.confirm('本当に削除しますか？')) {
            await deleteFeaturePhone(item.id);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm('本当に削除しますか')) {
            try {
                for (const id of selectedIds) {
                    await deleteFeaturePhone(id);
                }
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

    const handleSubmit = async (data: Omit<FeaturePhone, 'id'>) => {
        try {
            if (editingItem) {
                await updateFeaturePhone({ ...data, id: editingItem.id });
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
                await addFeaturePhone(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。サーバーが起動しているか確認してください。');
        }
    };

    // Permission Logic
    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: FeaturePhone) => {
        if (isAdmin) return true;
        // Check if the item belongs to the logged-in user
        // Assuming user.code is the employee code
        return user?.code === item.employeeId;
    };

    const getRowClassName = (item: FeaturePhone) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const filteredData = featurePhones.filter(item =>
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

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    const handleExportCSV = () => {
        const headers = [
            'キャリア', '電話番号', '管理番号', '社員コード', '使用者名',
            '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.carrier,
                item.phoneNumber,
                item.managementNumber,
                item.employeeId,
                item.user,
                item.addressCode,
                item.costCompany,
                item.lendDate,
                item.receiptDate,
                `"${item.notes}"`,
                item.returnDate,
                item.modelName
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `feature_phone_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'キャリア', '電話番号', '管理番号', '社員コード', '使用者名',
            '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名'
        ];

        // Create a worksheet with just the headers
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');

        XLSX.writeFile(wb, 'ガラホエクセルフォーマット.xlsx');
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
                'キャリア', '電話番号', '管理番号', '社員コード', '使用者名',
                '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名'
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

                const formatDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    return String(val);
                };

                const newFeaturePhone: Omit<FeaturePhone, 'id'> = {
                    carrier: String(rowData['キャリア'] || ''),
                    phoneNumber: String(rowData['電話番号'] || ''),
                    managementNumber: String(rowData['管理番号'] || ''),
                    employeeId: String(rowData['社員コード'] || ''),
                    user: String(rowData['使用者名'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    costCompany: String(rowData['負担先会社'] || ''),
                    lendDate: formatDate(rowData['貸与日']),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    notes: String(rowData['備考1'] || ''),
                    returnDate: formatDate(rowData['返却日']),
                    modelName: String(rowData['機種名'] || ''),
                };

                if (!newFeaturePhone.managementNumber) continue;

                try {
                    await addFeaturePhone(newFeaturePhone, true);
                    successCount++;
                } catch (error) {
                    console.error('Import error for row:', row, error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('featurePhones', 'import', `Excelインポート: ${successCount}件追加`);
            }

            if (hasError) return;

            alert(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };


    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">ガラホ管理台帳</h1>
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
                        placeholder="検索 (管理番号, 使用者, 電話番号...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<FeaturePhone>
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
                        header: '管理番号', accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium whitespace-nowrap"
                            >
                                {item.managementNumber}
                            </button>
                        )
                    },
                    { header: '機種名', accessor: 'modelName' },
                    { header: '電話番号', accessor: 'phoneNumber' },
                    { header: '使用者名', accessor: 'user' },
                    { header: 'キャリア', accessor: 'carrier' },
                    { header: '貸与日', accessor: 'lendDate' },
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
                title={editingItem ? 'ガラホ 編集' : 'ガラホ 新規登録'}
            >
                <FeaturePhoneForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <DetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="ガラホ 詳細"
                data={detailItem}
                labels={{
                    carrier: 'キャリア',
                    phoneNumber: '電話番号',
                    managementNumber: '管理番号',
                    employeeId: '社員コード',
                    user: '使用者名',
                    addressCode: '住所コード',
                    costCompany: '負担先会社',
                    lendDate: '貸与日',
                    receiptDate: '受領書提出日',
                    notes: '備考1',
                    returnDate: '返却日',
                    modelName: '機種名'
                }}
            />
        </div>
    );
};
