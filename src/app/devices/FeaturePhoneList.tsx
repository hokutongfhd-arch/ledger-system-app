import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../../features/context/DataContext';
import { Pagination } from '../../components/ui/Pagination';
import { Table } from '../../components/ui/Table';
import type { FeaturePhone } from '../../lib/types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { NotificationModal } from '../../components/ui/NotificationModal';
import { FeaturePhoneForm } from '../../features/forms/FeaturePhoneForm';
import { useAuth } from '../../features/context/AuthContext';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../lib/utils/stringUtils';

type SortKey = 'managementNumber' | 'lendDate' | 'contractYears' | 'modelName' | 'phoneNumber' | 'carrier' | 'userName';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export const FeaturePhoneList = () => {
    const { featurePhones, addFeaturePhone, updateFeaturePhone, deleteFeaturePhone, addLog, employees, addresses } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FeaturePhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<FeaturePhone | undefined>(undefined);
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
        showNotification(
            '本当に削除しますか？',
            'confirm',
            async () => {
                try {
                    await deleteFeaturePhone(item.id, true);
                    await addLog('featurePhones', 'delete', `ガラホ削除: ${item.managementNumber} (${item.employeeId})`);
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
                        await deleteFeaturePhone(id, true);
                    }
                    await addLog('featurePhones', 'delete', `ガラホ一括削除: ${selectedIds.size}件`);
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

    const handleSubmit = async (data: Omit<FeaturePhone, 'id'>) => {
        try {
            if (editingItem) {
                await updateFeaturePhone({ ...data, id: editingItem.id }, true);
                await addLog('featurePhones', 'update', `ガラホ更新: ${data.managementNumber} (${data.employeeId})`);
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
                await addFeaturePhone(data, true);
                await addLog('featurePhones', 'add', `ガラホ新規登録: ${data.managementNumber} (${data.employeeId})`);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showNotification('保存に失敗しました。サーバーが起動しているか確認してください。', 'alert', undefined, 'エラー');
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

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;

            let valA: any;
            let valB: any;

            if (key === 'userName') {
                valA = employees.find(e => e.code === a.employeeId)?.name || '';
                valB = employees.find(e => e.code === b.employeeId)?.name || '';
            } else {
                valA = a[key as keyof FeaturePhone] || '';
                valB = b[key as keyof FeaturePhone] || '';
            }

            if (key === 'contractYears') {
                const numA = parseInt(String(valA).replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB).replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) {
                    return order === 'asc' ? numA - numB : numB - numA;
                }
            } else if (valA !== valB) {
                if (valA < valB) return order === 'asc' ? -1 : 1;
                if (valA > valB) return order === 'asc' ? 1 : -1;
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

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    const handleExportCSV = () => {
        const headers = [
            'キャリア', '電話番号', '管理番号', '社員コード', // User Name removed
            '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名', '契約年数'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.carrier,
                item.phoneNumber,
                item.managementNumber,
                item.employeeId,
                item.addressCode,
                item.costCompany,
                item.lendDate,
                item.receiptDate,
                `"${item.notes}"`,
                `"${item.notes}"`,
                item.returnDate,
                item.modelName,
                item.contractYears || ''
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
            'キャリア', '電話番号', '管理番号', '社員コード',
            '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名', '契約年数'
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
                showNotification('ファイルが空です。', 'alert', undefined, 'エラー');
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                'キャリア', '電話番号', '管理番号', '社員コード',
                '住所コード', '負担先会社', '貸与日', '受領書提出日', '備考1', '返却日', '機種名', '契約年数'
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
                    addressCode: String(rowData['住所コード'] || ''),
                    costCompany: String(rowData['負担先会社'] || ''),
                    lendDate: formatDate(rowData['貸与日']),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    notes: String(rowData['備考1'] || ''),
                    returnDate: formatDate(rowData['返却日']),
                    modelName: String(rowData['機種名'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
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

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
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
                        placeholder="検索 (管理番号, 電話番号...)"
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
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('managementNumber')}>
                                <span>管理番号</span>
                                {getSortIcon('managementNumber')}
                            </div>
                        ),
                        accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium whitespace-nowrap"
                            >
                                {item.managementNumber}
                            </button>
                        )
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('modelName')}>
                                <span>機種名</span>
                                {getSortIcon('modelName')}
                            </div>
                        ),
                        accessor: 'modelName'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('phoneNumber')}>
                                <span>電話番号</span>
                                {getSortIcon('phoneNumber')}
                            </div>
                        ),
                        accessor: 'phoneNumber'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('userName')}>
                                <span>使用者名</span>
                                {getSortIcon('userName')}
                            </div>
                        ),
                        accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || ''
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('carrier')}>
                                <span>キャリア</span>
                                {getSortIcon('carrier')}
                            </div>
                        ),
                        accessor: 'carrier'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('lendDate')}>
                                <span>貸与日</span>
                                {getSortIcon('lendDate')}
                            </div>
                        ),
                        accessor: 'lendDate'
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
                title={editingItem ? 'ガラホ 編集' : 'ガラホ 新規登録'}
            >
                <FeaturePhoneForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="ガラホ 詳細"
            >
                {detailItem && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">管理番号</label>
                                    <div className="text-gray-900">{detailItem.managementNumber}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">機種名</label>
                                    <div className="text-gray-900">{detailItem.modelName}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">電話番号</label>
                                    <div className="text-gray-900">{detailItem.phoneNumber}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">キャリア</label>
                                    <div className="text-gray-900">{detailItem.carrier || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">契約年数</label>
                                    <div className="text-gray-900">{detailItem.contractYears || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">社員コード</label>
                                    <div className="text-gray-900">
                                        {detailItem.employeeId}
                                        {detailItem.employeeId && (
                                            <span className="ml-2 text-gray-600">
                                                ({employees.find(e => e.code === detailItem.employeeId)?.name || '未登録'})
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
                                    <label className="block text-sm font-medium text-gray-500 mb-1">貸与日</label>
                                    <div className="text-gray-900">{detailItem.lendDate || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">管理情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">負担先会社</label>
                                    <div className="text-gray-900">{detailItem.costCompany || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">受領書提出日</label>
                                    <div className="text-gray-900">{detailItem.receiptDate || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">返却日</label>
                                    <div className="text-gray-900">{detailItem.returnDate || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-500 mb-1">備考1</label>
                                <div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div>
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
