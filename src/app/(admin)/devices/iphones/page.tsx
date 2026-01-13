'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { IPhone } from '../../../../features/devices/device.types';
import { Plus, Download, Search, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { IPhoneForm } from '../../../../features/devices/components/IPhoneForm';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../../lib/utils/stringUtils';
import { IPhoneDetailModal } from '../../../../features/devices/components/IPhoneDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import { formatPhoneNumber } from '../../../../lib/utils/phoneUtils';
import { useToast } from '../../../../features/context/ToastContext';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

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
    const { iPhones, addIPhone, updateIPhone, deleteIPhone, deleteManyIPhones, employees, addresses } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const highlightId = searchParams.get('highlight');
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<IPhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<IPhone | undefined>(undefined);

    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<IPhone>({
        data: iPhones,
        searchKeys: ['managementNumber', 'phoneNumber', 'modelName', 'carrier', 'notes'],
        sortConfig: {
            employeeId: (a, b) => { // User Name Sort
                const nameA = employees.find(e => e.code === a.employeeId)?.name || '';
                const nameB = employees.find(e => e.code === b.employeeId)?.name || '';
                return nameA.localeCompare(nameB);
            },
            contractYears: (a, b) => {
                const numA = parseInt(String(a.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.contractYears || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }
        }
    });

    const { handleExport } = useCSVExport<IPhone>();
    const headers = [
        'キャリア', '電話番号', '管理番号', '機種名', '契約年数',
        '社員コード', '事業所コード', '貸与日', '受領書提出日', '返却日',
        'SMARTアドレス帳ID', 'SMARTアドレス帳PW', '備考'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        onValidate: async (rows, fileHeaders) => {
            const requiredHeaders = headers;
            const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
            if (missingHeaders.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: `不足している項目があります: ${missingHeaders.join(', ')}`,
                    confirmText: 'OK',
                    cancelText: ''
                });
                return false;
            }

            const validColumnCount = requiredHeaders.length;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
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
                        return false;
                    }
                }
            }
            return true;
        },
        onImport: async (rows, fileHeaders) => {
            let successCount = 0;
            let errorCount = 0;
            const existingManagementNumbers = new Set(iPhones.map(d => d.managementNumber));
            const existingPhoneNumbers = new Set(iPhones.map(d => d.phoneNumber.replace(/-/g, '')));
            const processedManagementNumbers = new Set<string>();
            const processedPhoneNumbers = new Set<string>();
            const errors: string[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const toHalfWidth = (str: string) => str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                const normalizePhone = (phone: string) => toHalfWidth(phone).trim().replace(/-/g, '');

                let rowHasError = false;
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

                const rawPhoneNumber = String(rowData['電話番号'] || '');
                const phoneNumber = formatPhoneNumber(toHalfWidth(rawPhoneNumber).trim());
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
                    phoneNumber: phoneNumber,
                    managementNumber: managementNumber,
                    employeeId: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['事業所コード'] || ''),
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
                    await addIPhone(newIPhone as Omit<IPhone, 'id'>, true, true);
                    processedManagementNumbers.add(managementNumber);
                    processedPhoneNumbers.add(normalizedPhone);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (errors.length > 0) {
                await confirm({
                    title: 'インポート結果 (一部スキップ)',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <ul>{errors.map((err, idx) => <li key={idx} className="text-red-600">{err}</li>)}</ul>
                        </div>
                    ),
                    confirmText: 'OK',
                    cancelText: ''
                });
            }

            if (successCount > 0 || errorCount > 0) {
                showToast(`インポート完了 - 成功: ${successCount}件 / 失敗: ${errorCount}件`, errorCount > 0 ? 'warning' : 'success');
            }
        }
    });

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: IPhone) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: IPhone) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にこのiPhoneを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteIPhone(item.id);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件のiPhoneを削除しますか？`,
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (confirmed) {
            try {
                await deleteManyIPhones(Array.from(selectedIds));
                setSelectedIds(new Set());
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleExportCSVClick = async () => {
        // Log the export action
        await logger.log({
            action: 'EXPORT',
            targetType: 'iphone',
            targetId: 'iphone_list',
            result: 'success',
            message: `iPhone一覧のエクスポート: ${filteredData.length}件`
        });

        handleExport(filteredData, headers, `iphone_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.id,
            item.managementNumber,
            item.phoneNumber,
            item.modelName,
            item.carrier,
            normalizeContractYear(item.contractYears || ''),
            item.employeeId,
            item.addressCode,
            item.lendDate,
            item.receiptDate,
            item.returnDate,
            item.smartAddressId,
            item.smartAddressPw,
            `"${item.notes}"`
        ]);
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const totalRows = 1000;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows, c: headers.length - 1 } });
        for (let R = 1; R <= totalRows; ++R) {
            const ref = XLSX.utils.encode_cell({ r: R, c: 2 });
            ws[ref] = { t: 's', v: '', z: '@' };
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'iPhoneエクセルフォーマット.xlsx');
    };

    const isAdmin = user?.role === 'admin';
    const hasPermission = (item: IPhone) => isAdmin || user?.code === item.employeeId;

    const getSortIcon = (key: keyof IPhone) => {
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

    // Highlight effect
    const getRowClassName = (item: IPhone) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">iPhone 管理台帳</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSVClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    {isAdmin && <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>}
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索 (管理番号, 電話番号...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent outline-none bg-background-subtle text-text-main" />
                </div>
            </div>

            <Table<IPhone>
                containerClassName="max-h-[600px] overflow-auto border-b border-border"
                data={paginatedData}
                rowClassName={getRowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('managementNumber')}>管理番号{getSortIcon('managementNumber')}</div>,
                        accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.managementNumber}</button>
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('modelName')}>機種名{getSortIcon('modelName')}</div>, accessor: 'modelName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('phoneNumber')}>電話番号{getSortIcon('phoneNumber')}</div>, accessor: (item) => formatPhoneNumber(item.phoneNumber) },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('employeeId')}>使用者名{getSortIcon('employeeId')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || '' },
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
                totalPages={Math.ceil(filteredData.length / pageSize)}
                totalItems={filteredData.length}
                startIndex={(currentPage - 1) * pageSize}
                endIndex={Math.min(currentPage * pageSize, filteredData.length)}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                selectedCount={selectedIds.size}
                onBulkDelete={handleBulkDelete}
            />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'iPhone 編集' : 'iPhone 新規登録'}>
                <IPhoneForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateIPhone({ ...data, id: editingItem.id } as IPhone);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addIPhone(data as Omit<IPhone, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <IPhoneDetailModal
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
