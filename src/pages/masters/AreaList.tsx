
import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { Table } from '../../components/ui/Table';
import type { Area } from '../../types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/ui/Modal';
import { DetailModal } from '../../components/ui/DetailModal';
import { AreaForm } from '../../components/forms/AreaForm';
import { useAuth } from '../../context/AuthContext';

export const AreaList = () => {
    const { areas, addArea, updateArea, deleteArea, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Area | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Area | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleAdd = () => {
        setEditingItem(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (item: Area) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: Area) => {
        if (window.confirm('本当に削除しますか？')) {
            await deleteArea(item.id);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm('本当に削除しますか')) {
            try {
                for (const id of selectedIds) {
                    await deleteArea(id);
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

    const handleSubmit = async (data: Omit<Area, 'id'>) => {
        try {
            if (editingItem) {
                await updateArea({ ...data, id: editingItem.id });
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
                await addArea(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。サーバーが起動しているか確認してください。');
        }
    };

    const getRowClassName = (item: Area) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const filteredData = areas.filter(item =>
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
        const headers = ['エリアコード', 'エリア名'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.areaCode,
                item.areaName,
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `area_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = ['エリアコード', 'エリア名'];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'エリアマスタエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Define headers map
                const headerMap: Record<string, keyof Omit<Area, 'id'>> = {
                    'エリアコード': 'areaCode',
                    'エリア名': 'areaName'
                };

                const validHeaders = Object.keys(headerMap);

                if (data.length === 0) {
                    alert('データがありません。');
                    return;
                }

                const firstRow = data[0] as object;
                const invalidColumns = Object.keys(firstRow).filter(key => !validHeaders.includes(key));

                if (invalidColumns.length > 0) {
                    alert(`不正なカラムが含まれています: ${invalidColumns.join(', ')}`);
                    return;
                }

                let successCount = 0;
                for (const row of data) {
                    const areaData: any = {};
                    Object.entries(row as object).forEach(([key, value]) => {
                        if (headerMap[key]) {
                            areaData[headerMap[key]] = value;
                        }
                    });

                    if (!areaData.areaCode || !areaData.areaName) {
                        continue;
                    }

                    await addArea(areaData as Omit<Area, 'id'>, true);
                    successCount++;
                }

                if (successCount > 0) {
                    await addLog('areas', 'import', `Excelインポート: ${successCount}件追加`);
                }

                alert(`${successCount}件のインポートが完了しました。`);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('インポート中にエラーが発生しました。');
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">エリアマスタ</h1>
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
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <button
                        onClick={handleImportClick}
                        className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle transition-colors shadow-sm"
                    >
                        <Upload size={18} />
                        インポート
                    </button>
                    {isAdmin && (
                        <button
                            onClick={handleAdd}
                            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-sm"
                        >
                            <Plus size={18} />
                            新規登録
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="検索 (エリアコード, エリア名...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<Area>
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
                        header: 'エリアコード', accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-primary hover:text-primary-hover hover:underline text-left font-medium"
                            >
                                {item.areaCode}
                            </button>
                        )
                    },
                    { header: 'エリア名', accessor: 'areaName' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={() => isAdmin}
                canDelete={() => isAdmin}
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
                title={editingItem ? 'エリア編集' : 'エリア新規登録'}
            >
                <AreaForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <DetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="エリア詳細"
                data={detailItem}
                labels={{
                    areaCode: 'エリアコード',
                    areaName: 'エリア名'
                }}
            />
        </div>
    );
};
