'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Address } from '../../../../features/addresses/address.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { AddressForm } from '../../../../features/addresses/components/AddressForm';
import { AddressDetailModal } from '../../../../features/addresses/components/AddressDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import * as XLSX from 'xlsx';
import { useToast } from '../../../../features/context/ToastContext';
import { formatPhoneNumber } from '../../../../lib/utils/phoneUtils';
import { formatZipCode } from '../../../../lib/utils/zipCodeUtils';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

export default function AddressListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return <AddressListContent />;
}

function AddressListContent() {
    const { addresses, addAddress, updateAddress, deleteAddress, deleteManyAddresses, areas } = useData();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Address | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Address | undefined>(undefined);

    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    // -- Hooks --
    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<Address>({
        data: addresses,
        initialPageSize: 15,
        searchKeys: ['addressCode', 'officeName', 'division', 'area', 'tel', 'fax', 'zipCode', 'address', 'type', 'mainPerson', 'branchNumber', 'specialNote', 'labelName', 'labelZip', 'labelAddress', 'notes', 'attentionNote'], // Broad search
        sortConfig: {
            addressCode: (a, b) => {
                const partsA = (a.addressCode || '').split('-');
                const partsB = (b.addressCode || '').split('-');
                const firstA = parseInt(partsA[0]) || 0;
                const firstB = parseInt(partsB[0]) || 0;
                if (firstA !== firstB) return firstA - firstB;
                const secondA = parseInt(partsA[1]) || 0;
                const secondB = parseInt(partsB[1]) || 0;
                return secondA - secondB;
            }
        }
    });

    const { handleExport } = useCSVExport<Address>();

    const headers = ['No.', '住所コード', '事業所名', '事業部', 'エリアコード', 'TEL', 'FAX', '〒', '住所', '区分', '主担当', '枝番', '※', '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '備考', '注意書き'];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        onValidate: async (rows, fileHeaders) => {
            const missingHeaders = headers.filter(h => !fileHeaders.includes(h));
            if (missingHeaders.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: `不足している項目があります: ${missingHeaders.join(', ')}`,
                    confirmText: 'OK',
                    cancelText: ''
                });
                return false;
            }

            // Data bounds validation
            const validColumnCount = headers.length;
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

            const existingCodes = new Set(addresses.map(a => a.addressCode));
            const processedCodes = new Set<string>();
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

                const toHalfWidth = (str: string) => {
                    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
                        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
                    });
                };

                // Address Code Check
                const rawCode = String(rowData['住所コード'] || '');
                const code = toHalfWidth(rawCode).trim();

                if (!code) {
                    errorCount++;
                    continue;
                }

                if (existingCodes.has(code)) {
                    errors.push(`${i + 2}行目: 住所コード「${code}」は既に存在します`);
                    errorCount++;
                    continue;
                }
                if (processedCodes.has(code)) {
                    errors.push(`${i + 2}行目: 住所コード「${code}」がファイル内で重複しています`);
                    errorCount++;
                    continue;
                }

                const areaCodeRaw = String(rowData['エリアコード'] || '');
                const areaCode = toHalfWidth(areaCodeRaw).trim();
                const matchedArea = areas.find(a => a.areaCode === areaCode);
                const areaName = matchedArea ? matchedArea.areaName : '';

                const newAddress: Omit<Address, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    addressCode: code,
                    officeName: String(rowData['事業所名'] || ''),
                    division: String(rowData['事業部'] || ''),
                    area: areaName,
                    tel: formatPhoneNumber(String(rowData['TEL'] || '')),
                    fax: formatPhoneNumber(String(rowData['FAX'] || '')),
                    zipCode: formatZipCode(String(rowData['〒'] || '')),
                    address: String(rowData['住所'] || ''),
                    type: String(rowData['区分'] || ''),
                    mainPerson: String(rowData['主担当'] || ''),
                    branchNumber: String(rowData['枝番'] || ''),
                    specialNote: String(rowData['※'] || ''),
                    labelName: String(rowData['宛名ラベル用'] || ''),
                    labelZip: formatZipCode(String(rowData['宛名ラベル用〒'] || '')),
                    labelAddress: String(rowData['宛名ラベル用住所'] || ''),
                    notes: String(rowData['備考'] || ''),
                    attentionNote: String(rowData['注意書き'] || '')
                };

                try {
                    await addAddress(newAddress, true, true);
                    processedCodes.add(code);
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
                            <p className="mb-2">以下のデータは登録されませんでした：</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
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
    const handleEdit = (item: Address) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Address) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当に削除しますか？',
            confirmText: '削除',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteAddress(item.id);
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
                await deleteManyAddresses(Array.from(selectedIds));
                setSelectedIds(new Set());
            } catch (error) {
                console.error("Bulk delete failed", error);
            }
        }
    };

    const handleExportCSVClick = async () => {
        // Log the export action
        await logger.log({
            action: 'EXPORT',
            targetType: 'address',
            targetId: 'address_list',
            result: 'success',
            message: `住所マスタのエクスポート: ${filteredData.length}件`
        });

        handleExport(filteredData, headers, `address_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => {
            const areaCode = areas.find(a => a.areaName === item.area)?.areaCode || '';
            return [
                item.no || '',
                item.addressCode || '',
                item.officeName || '',
                item.division || '',
                areaCode,
                item.tel || '',
                item.fax || '',
                item.zipCode || '',
                item.address || '',
                item.type || '',
                item.mainPerson || '',
                item.branchNumber || '',
                item.specialNote || '',
                item.labelName || '',
                item.labelZip || '',
                item.labelAddress || '',
                item.notes || '',
                item.attentionNote || ''
            ];
        });
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);

        const totalRows = 1000;
        ws['!ref'] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: totalRows, c: headers.length - 1 }
        });

        const textCols = [1, 4, 5, 6, 7];
        for (let R = 1; R <= totalRows; ++R) {
            textCols.forEach(C => {
                const ref = XLSX.utils.encode_cell({ r: R, c: C });
                ws[ref] = { t: 's', v: '', z: '@' };
            });
        }

        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '住所マスタエクセルフォーマット.xlsx');
    };

    const getSortIcon = (key: keyof Address) => {
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

    const isAdmin = user?.role === 'admin';

    // Highlight effect
    const rowClassName = (item: Address) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">住所マスタ</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSVClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                </div>
            </div>

            <Table<Address>
                data={paginatedData}
                rowClassName={rowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('addressCode')}>住所コード{getSortIcon('addressCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.addressCode}</button> },
                    { header: '事業所名', accessor: 'officeName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('tel')}>ＴＥＬ{getSortIcon('tel')}</div>, accessor: (item) => formatPhoneNumber(item.tel) },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('fax')}>ＦＡＸ{getSortIcon('fax')}</div>, accessor: (item) => formatPhoneNumber(item.fax) },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('zipCode')}>〒{getSortIcon('zipCode')}</div>, accessor: (item) => formatZipCode(item.zipCode) },
                    { header: '住所', accessor: 'address' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={(item) => isAdmin || user?.name === item.mainPerson}
                canDelete={() => isAdmin}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '住所 編集' : '住所 新規登録'}>
                <AddressForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateAddress({ ...data, id: editingItem.id } as Address);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addAddress(data as Omit<Address, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <AddressDetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                item={detailItem}
                areas={areas}
            />

            <ConfirmDialog />
        </div>
    );
}
