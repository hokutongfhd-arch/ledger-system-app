'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { FeaturePhone } from '../../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { NotificationModal } from '../../../../components/ui/NotificationModal';
import { FeaturePhoneForm } from '../../../../features/forms/FeaturePhoneForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import { FeaturePhoneDetailModal } from '../../../../features/devices/components/FeaturePhoneDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import { formatPhoneNumber } from '../../../../lib/utils/phoneUtils';
import { useToast } from '../../../../features/context/ToastContext';

type SortKey = 'managementNumber' | 'lendDate' | 'contractYears' | 'modelName' | 'phoneNumber' | 'carrier' | 'userName';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export default function FeaturePhoneListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return <FeaturePhoneListContent />;
}

function FeaturePhoneListContent() {
    const { featurePhones, addFeaturePhone, updateFeaturePhone, deleteFeaturePhone, deleteManyFeaturePhones, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FeaturePhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<FeaturePhone | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: FeaturePhone) => {
        if (isAdmin) return true;
        return user?.code === item.employeeId;
    };

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: FeaturePhone) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: FeaturePhone) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当に削除しますか？',
            confirmText: '削除',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteFeaturePhone(item.id, false, false);
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
                await deleteManyFeaturePhones(Array.from(selectedIds));
                setSelectedIds(new Set());
            } catch (error) {
                console.error("Bulk delete failed", error);
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

    const filteredData = featurePhones.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = key === 'userName' ? (employees.find(e => e.code === a.employeeId)?.name || '') : a[key as keyof FeaturePhone];
            let valB: any = key === 'userName' ? (employees.find(e => e.code === b.employeeId)?.name || '') : b[key as keyof FeaturePhone];

            if (key === 'contractYears') {
                const numA = parseInt(String(valA || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB || '').replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) return order === 'asc' ? numA - numB : numB - numA;
            } else if (valA !== valB) {
                return order === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
            }
        }
        return 0;
    });

    // データの削除などにより現在のページが無効になった場合に調整する
    useEffect(() => {
        const totalPages = Math.ceil(sortedData.length / pageSize);
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [sortedData.length, pageSize, currentPage]);

    const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
            '管理番号', '機種名', '電話番号', 'キャリア', '契約年数',
            '社員コード', '住所コード', '貸与日', '負担先会社', '受領書提出日', '返却日', '備考'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.managementNumber,
                item.modelName,
                item.phoneNumber,
                item.carrier,
                item.contractYears || '',
                item.employeeId,
                item.addressCode,
                item.lendDate,
                item.costCompany || '',
                item.receiptDate,
                item.returnDate,
                `"${item.notes}"`
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
            '管理番号', '機種名', '電話番号', 'キャリア', '契約年数',
            '社員コード', '住所コード', '貸与日', '負担先会社', '受領書提出日', '返却日', '備考'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);

        // 1000行分をシートの範囲として明示的に設定する
        const totalRows = 1000;
        ws['!ref'] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: totalRows, c: headers.length - 1 }
        });

        // 電話番号列 (インデックス 2 = C列) を文字列形式に設定
        for (let R = 1; R <= totalRows; ++R) {
            const ref = XLSX.utils.encode_cell({ r: R, c: 2 });
            ws[ref] = { t: 's', v: '', z: '@' };
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'ガラホエクセルフォーマット.xlsx');
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
                '管理番号', '機種名', '電話番号', 'キャリア', '契約年数',
                '社員コード', '住所コード', '貸与日', '負担先会社', '受領書提出日', '返却日', '備考'
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

            const existingManagementNumbers = new Set(featurePhones.map(d => d.managementNumber));
            const existingPhoneNumbers = new Set(featurePhones.map(d => d.phoneNumber.replace(/-/g, '')));
            const processedManagementNumbers = new Set<string>();
            const processedPhoneNumbers = new Set<string>();
            const errors: string[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                // 行が実質的に空（すべてのセルが空）であるかチェック
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const toHalfWidth = (str: string) => {
                    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
                        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
                    });
                };

                const normalizePhone = (phone: string) => {
                    const hw = toHalfWidth(phone).trim();
                    return hw.replace(/-/g, '');
                };

                let rowHasError = false;

                // Check Management Number
                const rawManagementNumber = String(rowData['管理番号'] || '');
                const managementNumber = toHalfWidth(rawManagementNumber).trim();

                if (!managementNumber) {
                    errors.push(`${i + 2}行目: 管理番号が空です`);
                    rowHasError = true;
                } else {
                    if (existingManagementNumbers.has(managementNumber)) {
                        errors.push(`${i + 2}行目: 管理番号「${managementNumber}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedManagementNumbers.has(managementNumber)) {
                        errors.push(`${i + 2}行目: 管理番号「${managementNumber}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                // Check Phone Number
                const rawPhoneNumber = String(rowData['電話番号'] || '');
                const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());

                // Re-calculate derived values since we need them for insertion
                const normalizedPhone = normalizePhone(phoneNumber);

                if (!phoneNumber) {
                    errors.push(`${i + 2}行目: 電話番号が空です`);
                    rowHasError = true;
                } else {
                    if (existingPhoneNumbers.has(normalizedPhone)) {
                        errors.push(`${i + 2}行目: 電話番号「${phoneNumber}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedPhoneNumbers.has(normalizedPhone)) {
                        errors.push(`${i + 2}行目: 電話番号「${phoneNumber}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                if (rowHasError) {
                    errorCount++;
                    continue;
                }

                processedManagementNumbers.add(managementNumber);
                processedPhoneNumbers.add(normalizedPhone);

                const formatDate = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const date = new Date((val - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    return String(val).trim().replace(/\//g, '-');
                };

                const newFeaturePhone: Omit<FeaturePhone, 'id'> = {
                    carrier: String(rowData['キャリア'] || ''),
                    phoneNumber: phoneNumber,
                    managementNumber: managementNumber,
                    employeeId: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    lendDate: formatDate(rowData['貸与日']),
                    receiptDate: formatDate(rowData['受領書提出日']),
                    notes: String(rowData['備考'] || ''),
                    returnDate: formatDate(rowData['返却日']),
                    modelName: String(rowData['機種名'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    costCompany: String(rowData['負担先会社'] || ''),
                    status: '貸出準備中'
                };

                if (newFeaturePhone.employeeId) newFeaturePhone.status = '貸出中';

                try {
                    await addFeaturePhone(newFeaturePhone, true, true);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (errors.length > 0) {
                await confirm({
                    title: 'インポート結果 (一部スキップ)',
                    description: (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <p className="mb-2">以下のデータは登録されませんでした：</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm text-red-600">
                                {errors.map((err, index) => (
                                    <li key={index}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    ),
                    confirmText: 'OK',
                    cancelText: ''
                });
            }

            if (successCount > 0) {
                // Manual log removed - covered by DB triggers
            }

            if (successCount > 0 || errorCount > 0) {
                showToast(`インポート完了 - 成功: ${successCount}件 / 失敗: ${errorCount}件`, errorCount > 0 ? 'warning' : 'success');
            }
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">ガラホ管理台帳</h1>
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

            <Table<FeaturePhone>
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('managementNumber')}>管理番号{getSortIcon('managementNumber')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.managementNumber}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('modelName')}>機種名{getSortIcon('modelName')}</div>, accessor: 'modelName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('phoneNumber')}>電話番号{getSortIcon('phoneNumber')}</div>, accessor: (item) => formatPhoneNumber(item.phoneNumber) },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('lendDate')}>貸与日{getSortIcon('lendDate')}</div>, accessor: 'lendDate' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: (item) => normalizeContractYear(item.contractYears || '') },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={hasPermission}
                canDelete={hasPermission}
            />

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(sortedData.length / pageSize)}
                totalItems={sortedData.length}
                startIndex={(currentPage - 1) * pageSize}
                endIndex={Math.min(currentPage * pageSize, sortedData.length)}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
            />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'ガラホ 編集' : 'ガラホ 新規登録'}>
                <FeaturePhoneForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateFeaturePhone({ ...data, id: editingItem.id } as FeaturePhone);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addFeaturePhone(data as Omit<FeaturePhone, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <FeaturePhoneDetailModal
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
