'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { IPhone } from '../../../../features/devices/device.types';
import { Plus, Download, Search, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { NotificationModal } from '../../../../components/ui/NotificationModal';
import { IPhoneForm } from '../../../../features/forms/IPhoneForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import { IPhoneDetailModal } from '../../../../features/devices/components/IPhoneDetailModal';

type SortKey = 'managementNumber' | 'lendDate' | 'contractYears' | 'modelName' | 'phoneNumber' | 'carrier' | 'userName';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export default function IPhoneListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [user, router]);

    if (!user) return null;

    return <IPhoneListContent />;
}

function IPhoneListContent() {
    const { iPhones, addIPhone, updateIPhone, deleteIPhone, addLog, employees, addresses } = useData();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<IPhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<IPhone | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

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

    const createQueryString = useCallback(
        (paramsToUpdate: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            Object.entries(paramsToUpdate).forEach(([name, value]) => {
                if (value === null) {
                    params.delete(name);
                } else {
                    params.set(name, value);
                }
            });
            return params.toString();
        },
        [searchParams]
    );

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

    const handleEdit = (item: IPhone) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: IPhone) => {
        showNotification(
            '本当に削除しますか？',
            'confirm',
            async () => {
                try {
                    await deleteIPhone(item.id, true);
                    await addLog('iphones', 'delete', `iPhone削除: ${item.managementNumber} (${item.employeeId})`);
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
                        await deleteIPhone(id, true);
                    }
                    await addLog('iphones', 'delete', `iPhone一括削除: ${selectedIds.size}件`);
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

    const handleSubmit = async (data: Omit<IPhone, 'id'> & { id?: string }) => {
        try {
            if (editingItem) {
                await updateIPhone({ ...data, id: editingItem.id } as IPhone, true);
                await addLog('iphones', 'update', `iPhone更新: ${data.managementNumber} (${data.employeeId})`);
                if (editingItem.id === searchParams.get('highlight')) {
                    router.replace(pathname + '?' + createQueryString({ highlight: null, field: null }));
                }
            } else {
                await addIPhone(data as Omit<IPhone, 'id'>, true);
                await addLog('iphones', 'add', `iPhone新規登録: ${data.managementNumber} (${data.employeeId})`);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            showNotification('保存に失敗しました。', 'alert', undefined, 'エラー');
        }
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: IPhone) => {
        if (isAdmin) return true;
        return user?.code === item.employeeId;
    };

    const getRowClassName = (item: IPhone) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const filteredData = iPhones.filter(item =>
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
                valA = a[key as keyof IPhone] || '';
                valB = b[key as keyof IPhone] || '';
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

    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = sortedData.slice(startIndex, endIndex);

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
            'ID', '管理番号', '電話番号', '機種名', 'キャリア', '契約年数',
            '社員コード', '住所コード', '貸与日', '受領書提出日', '返却日',
            'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.id,
                item.managementNumber,
                item.phoneNumber,
                item.modelName,
                item.carrier,
                item.contractYears || '',
                item.employeeId,
                item.addressCode,
                item.lendDate,
                item.receiptDate,
                item.returnDate,
                item.smartAddressId,
                item.smartAddressPw,
                `"${item.notes}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `iphone_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'ID', '管理番号', '電話番号', '機種名', 'キャリア', '契約年数',
            '社員コード', '住所コード', '貸与日', '受領書提出日', '返却日',
            'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'iPhoneエクセルフォーマット.xlsx');
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
                showNotification('ファイルが空です。', 'alert', undefined, 'エラー');
                return;
            }

            const headers = jsonData[0] as string[];
            const requiredHeaders = [
                'ID', '管理番号', '電話番号', '機種名', 'キャリア', '契約年数',
                '社員コード', '住所コード', '貸与日', '受領書提出日', '返却日',
                'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
            ];

            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
            if (missingHeaders.length > 0) {
                showNotification(`不足している項目があります: ${missingHeaders.join(', ')}`, 'alert', undefined, 'インポートエラー');
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
                        showNotification('定義された列の外側にデータが存在します。ファイルを確認してください。', 'alert', undefined, 'インポートエラー');
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

                const formatDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    return String(val).trim().replace(/\//g, '-');
                };

                const newIPhone: Omit<IPhone, 'id'> & { id?: string } = {
                    carrier: String(rowData['キャリア'] || ''),
                    phoneNumber: String(rowData['電話番号'] || ''),
                    managementNumber: String(rowData['管理番号'] || ''),
                    employeeId: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    smartAddressId: String(rowData['SMARTアドレス帳ID'] || ''),
                    smartAddressPw: String(rowData['SMARTアドレス帳PW'] || ''),
                    lendDate: formatDate(rowData['貸与日']),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    notes: String(rowData['備考'] || ''),
                    returnDate: formatDate(rowData['返却日']),
                    modelName: String(rowData['機種名'] || ''),
                    status: '貸出準備中',
                    id: rowData['ID'] ? String(rowData['ID']) : undefined,
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || ''))
                };

                if (newIPhone.employeeId) newIPhone.status = '貸出中';

                try {
                    await addIPhone(newIPhone as Omit<IPhone, 'id'>, true);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('iphones', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
            }

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">iPhone 管理台帳</h1>
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
                    <input
                        type="text"
                        placeholder="検索 (管理番号, 電話番号...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent outline-none bg-background-subtle text-text-main"
                    />
                </div>
            </div>

            <Table<IPhone>
                containerClassName="max-h-[600px] overflow-auto border-b border-border"
                data={paginatedData}
                rowClassName={getRowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('managementNumber')}>管理番号{getSortIcon('managementNumber')}</div>,
                        accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.managementNumber}</button>
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('modelName')}>機種名{getSortIcon('modelName')}</div>, accessor: 'modelName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('phoneNumber')}>電話番号{getSortIcon('phoneNumber')}</div>, accessor: 'phoneNumber' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('lendDate')}>貸与日{getSortIcon('lendDate')}</div>, accessor: 'lendDate' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: 'contractYears' },
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
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
            />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'iPhone 編集' : 'iPhone 新規登録'}>
                <IPhoneForm initialData={editingItem} onSubmit={handleSubmit} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <IPhoneDetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                item={detailItem}
                employees={employees}
                addresses={addresses}
            />

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
