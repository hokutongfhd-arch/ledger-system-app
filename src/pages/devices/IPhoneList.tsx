import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Table } from '../../components/ui/Table';
import type { IPhone } from '../../types';
import { Plus, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { DetailModal } from '../../components/ui/DetailModal';
import { IPhoneForm } from '../../components/forms/IPhoneForm';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { ActionButton } from '../../components/ui/ActionButton';

export const IPhoneList = () => {
    const { iPhones, addIPhone, updateIPhone, deleteIPhone, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<IPhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<IPhone | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { user } = useAuth(); // Need user for permission check

    const handleAdd = () => {
        setEditingItem(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (item: IPhone) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: IPhone) => {
        if (window.confirm('本当に削除しますか？')) {
            await deleteIPhone(item.id);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm('本当に削除しますか')) {
            try {
                // Execute deletions sequentially
                for (const id of selectedIds) {
                    await deleteIPhone(id);
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

    const handleSubmit = async (data: Omit<IPhone, 'id'> & { id?: string }) => {
        try {
            if (editingItem) {
                await updateIPhone({ ...data, id: editingItem.id });
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
                await addIPhone(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。サーバーが起動しているか確認してください。');
        }
    };

    // Permission Logic
    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: IPhone) => {
        if (isAdmin) return true;
        // Check if the item belongs to the logged-in user
        // Assuming user.code is the employee code
        return user?.code === item.employeeId;
    };

    const getRowClassName = (item: IPhone) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    // Filtering Logic
    const filteredData = iPhones.filter(item =>
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

    // Check if all items on current page are selected
    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    // CSV Export Logic
    const handleExportCSV = () => {
        const headers = [
            'キャリア', '電話番号', '管理番号', '社員コード', '使用者名',
            '住所コード', 'SMARTアドレス帳ID', 'SMARTアドレス帳PW',
            '貸与日', '受領書提出日', '備考1', '返却日', '機種名', 'ID'
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
                item.smartAddressId,
                item.smartAddressPw,
                item.lendDate,
                item.receiptDate,
                `"${item.notes}"`,
                item.returnDate,
                item.modelName,
                item.id
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `iphone_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
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
                '住所コード', 'SMARTアドレス帳ID', 'SMARTアドレス帳PW',
                '貸与日', '受領書提出日', '備考1', '返却日', '機種名', 'ID'
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

                const newIPhone: Omit<IPhone, 'id'> & { id?: string } = {
                    carrier: String(rowData['キャリア'] || ''),
                    phoneNumber: String(rowData['電話番号'] || ''),
                    managementNumber: String(rowData['管理番号'] || ''),
                    employeeId: String(rowData['社員コード'] || ''),
                    user: String(rowData['使用者名'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    smartAddressId: String(rowData['SMARTアドレス帳ID'] || ''),
                    smartAddressPw: String(rowData['SMARTアドレス帳PW'] || ''),
                    lendDate: formatDate(rowData['貸与日']),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    notes: String(rowData['備考1'] || ''),
                    returnDate: formatDate(rowData['返却日']),
                    modelName: String(rowData['機種名'] || ''),
                    status: '貸出準備中',
                    id: rowData['ID'] ? String(rowData['ID']) : undefined
                };

                if (newIPhone.user) newIPhone.status = '貸出中';

                if (!newIPhone.managementNumber) continue;

                try {
                    await addIPhone(newIPhone, true);
                    successCount++;
                } catch (error) {
                    console.error('Import error for row:', row, error);
                    errorCount++;
                }
            }

            if (hasError) return;

            if (successCount > 0) {
                await addLog('iPhones', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
            }

            alert(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'キャリア', '電話番号', '管理番号', '社員コード', '使用者名',
            '住所コード', 'SMARTアドレス帳ID', 'SMARTアドレス帳PW',
            '貸与日', '受領書提出日', '備考1', '返却日', '機種名', 'ID'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'iPhoneエクセルフォーマット.xlsx');
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <PageHeader
                title="iPhone 管理台帳"
                actions={
                    <>
                        <ActionButton onClick={handleExportCSV} icon={Download}>
                            CSV出力
                        </ActionButton>
                        <ActionButton onClick={handleDownloadTemplate} icon={FileSpreadsheet}>
                            フォーマットDL
                        </ActionButton>
                        <ActionButton onClick={handleImportClick} icon={Upload}>
                            インポート
                        </ActionButton>
                        <input
                            type="file"
                            id="fileInput"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <ActionButton onClick={handleAdd} icon={Plus} variant="primary">
                            新規登録
                        </ActionButton>
                    </>
                }
            />

            <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="検索 (管理番号, 使用者, 電話番号...)"
                onFilterClick={() => { /* Filter logic extension */ }}
            />

            <Table<IPhone>
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
                title={editingItem ? 'iPhone 編集' : 'iPhone 新規登録'}
            >
                <IPhoneForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <DetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="iPhone 詳細"
                data={detailItem}
                labels={{
                    carrier: 'キャリア',
                    phoneNumber: '電話番号',
                    managementNumber: '管理番号',
                    employeeId: '社員コード',
                    user: '使用者名',
                    addressCode: '住所コード',
                    smartAddressId: 'SMARTアドレス帳ID',
                    smartAddressPw: 'SMARTアドレス帳PW',
                    lendDate: '貸与日',
                    receiptDate: '受領書提出日',
                    notes: '備考1',
                    returnDate: '返却日',
                    modelName: '機種名',
                    id: 'ID'
                }}
            />
        </div>
    );
};
