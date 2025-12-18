import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../features/context/DataContext';
import { Pagination } from '../../components/ui/Pagination';
import { Table } from '../../components/ui/Table';
import type { Address } from '../../lib/types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/ui/Modal';
import { AddressForm } from '../../features/forms/AddressForm';
import { useAuth } from '../../features/context/AuthContext';
import { AddressDeviceList } from '../../features/components/AddressDeviceList';
import { NotificationModal } from '../../components/ui/NotificationModal';

type SortKey = 'addressCode' | 'tel' | 'fax' | 'zipCode';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export const AddressList = () => {
    const { addresses, addAddress, updateAddress, deleteAddress, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Address | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Address | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    const handleEdit = (item: Address) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: Address) => {
        showNotification(
            '本当に削除しますか？',
            'confirm',
            async () => {
                try {
                    await deleteAddress(item.id);
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
                        await deleteAddress(id);
                    }
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

    const handleSubmit = async (data: Omit<Address, 'id'>) => {
        try {
            if (editingItem) {
                await updateAddress({ ...data, id: editingItem.id });
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
                await addAddress(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showNotification('保存に失敗しました。サーバーが起動しているか確認してください。', 'alert', undefined, 'エラー');
        }
    };

    const canEdit = (item: Address) => {
        if (isAdmin) return true;
        return !!(user?.name && item.mainPerson === user.name);
    };

    const canDelete = (_: Address) => {
        return user?.role === 'admin';
    };

    const getRowClassName = (item: Address) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const filteredData = addresses.filter(item =>
        Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;

            if (key === 'addressCode') {
                const partsA = (a.addressCode || '').split('-');
                const partsB = (b.addressCode || '').split('-');

                // Compare first 4 digits
                const firstA = parseInt(partsA[0]) || 0;
                const firstB = parseInt(partsB[0]) || 0;

                if (firstA !== firstB) {
                    return order === 'asc' ? firstA - firstB : firstB - firstA;
                }

                // Compare last 2 digits if the first 4 are same
                const secondA = parseInt(partsA[1]) || 0;
                const secondB = parseInt(partsB[1]) || 0;

                if (secondA !== secondB) {
                    return order === 'asc' ? secondA - secondB : secondB - secondA;
                }
            } else {
                const valA = String(a[key as keyof Address] || '').toLowerCase();
                const valB = String(b[key as keyof Address] || '').toLowerCase();

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
        const headers = ['No.', '住所コード', '事業所名', 'ＴＥＬ', 'ＦＡＸ', '区分', '〒', '住所', '備考', '事業部', 'エリア', '主担当', '枝番', '※', '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '注意書き'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.no,
                item.addressCode,
                item.officeName,
                item.tel,
                item.fax,
                item.type,
                item.zipCode,
                `"${item.address}"`,
                `"${item.notes}"`,
                item.division,
                item.area,
                item.mainPerson,
                item.branchNumber,
                item.specialNote,
                item.labelName,
                item.labelZip,
                `"${item.labelAddress}"`,
                `"${item.attentionNote}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `address_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'No.', '住所コード', '事業所名', 'ＴＥＬ', 'ＦＡＸ', '区分', '〒', '住所', '備考',
            '事業部', 'エリア', '主担当', '枝番', '※', '宛名ラベル用', '宛名ラベル用〒',
            '宛名ラベル用住所', '注意書き'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '住所マスタエクセルフォーマット.xlsx');
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
                const headerMap: Record<string, keyof Omit<Address, 'id'>> = {
                    'No.': 'no',
                    '住所コード': 'addressCode',
                    '事業所名': 'officeName',
                    'ＴＥＬ': 'tel',
                    'ＦＡＸ': 'fax',
                    '区分': 'type',
                    '〒': 'zipCode',
                    '住所': 'address',
                    '備考': 'notes',
                    '事業部': 'division',
                    'エリア': 'area',
                    '主担当': 'mainPerson',
                    '枝番': 'branchNumber',
                    '※': 'specialNote',
                    '宛名ラベル用': 'labelName',
                    '宛名ラベル用〒': 'labelZip',
                    '宛名ラベル用住所': 'labelAddress',
                    '注意書き': 'attentionNote'
                };

                const validHeaders = Object.keys(headerMap);

                if (data.length === 0) {
                    showNotification('データがありません。', 'alert', undefined, 'エラー');
                    return;
                }

                const firstRow = data[0] as object;
                const invalidColumns = Object.keys(firstRow).filter(key => !validHeaders.includes(key));

                if (invalidColumns.length > 0) {
                    showNotification(`不正なカラムが含まれています: ${invalidColumns.join(', ')}`, 'alert', undefined, 'エラー');
                    return;
                }

                let successCount = 0;
                for (const row of data) {
                    const addressData: any = {};
                    Object.entries(row as object).forEach(([key, value]) => {
                        if (headerMap[key]) {
                            addressData[headerMap[key]] = value;
                        }
                    });

                    if (!addressData.addressCode) {
                        continue;
                    }

                    await addAddress(addressData as Omit<Address, 'id'>, true);
                    successCount++;
                }

                if (successCount > 0) {
                    await addLog('addresses', 'import', `Excelインポート: ${successCount}件追加`);
                }

                showNotification(`${successCount}件のインポートが完了しました。`);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Import error:', error);
                showNotification('インポート中にエラーが発生しました。', 'alert', undefined, 'エラー');
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">住所マスタ</h1>
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
                        placeholder="検索 (住所コード, 事業所名...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<Address>
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
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('addressCode')}>
                                <span>住所コード</span>
                                {getSortIcon('addressCode')}
                            </div>
                        ),
                        accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left font-medium"
                            >
                                {item.addressCode}
                            </button>
                        )
                    },
                    { header: '事業所名', accessor: 'officeName' },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('tel')}>
                                <span>ＴＥＬ</span>
                                {getSortIcon('tel')}
                            </div>
                        ),
                        accessor: 'tel'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('fax')}>
                                <span>ＦＡＸ</span>
                                {getSortIcon('fax')}
                            </div>
                        ),
                        accessor: 'fax'
                    },
                    {
                        header: (
                            <div className="flex items-center cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleSort('zipCode')}>
                                <span>〒</span>
                                {getSortIcon('zipCode')}
                            </div>
                        ),
                        accessor: 'zipCode'
                    },
                    { header: '住所', accessor: 'address' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={canEdit}
                canDelete={canDelete}
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
                title={editingItem ? '住所 編集' : '住所 新規登録'}
            >
                <AddressForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="住所 詳細"
            >
                {detailItem && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">No</label>
                                    <div className="text-gray-900">{detailItem.no}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所コード</label>
                                    <div className="text-gray-900">{detailItem.addressCode}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">事業所名</label>
                                    <div className="text-gray-900">{detailItem.officeName}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">事業部</label>
                                    <div className="text-gray-900">{detailItem.division || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">エリア</label>
                                    <div className="text-gray-900">{detailItem.area || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">連絡先情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">TEL</label>
                                    <div className="text-gray-900">{detailItem.tel || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">FAX</label>
                                    <div className="text-gray-900">{detailItem.fax || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">郵便番号</label>
                                    <div className="text-gray-900">{detailItem.zipCode || '-'}</div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所</label>
                                    <div className="text-gray-900">{detailItem.address || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">詳細情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">種別</label>
                                    <div className="text-gray-900">{detailItem.type || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">主担当者</label>
                                    <div className="text-gray-900">{detailItem.mainPerson || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">店番</label>
                                    <div className="text-gray-900">{detailItem.branchNumber || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">特記事項</label>
                                    <div className="text-gray-900">{detailItem.specialNote || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">宛名ラベル情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル名</label>
                                    <div className="text-gray-900">{detailItem.labelName || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル郵便番号</label>
                                    <div className="text-gray-900">{detailItem.labelZip || '-'}</div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル住所</label>
                                    <div className="text-gray-900">{detailItem.labelAddress || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">備考</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">注意書き</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.attentionNote || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {detailItem.addressCode && (
                            <AddressDeviceList addressCode={detailItem.addressCode} />
                        )}

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
        </div >
    );
};
