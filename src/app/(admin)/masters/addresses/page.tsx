'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Address } from '../../../../lib/types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { AddressForm } from '../../../../features/addresses/components/AddressForm';
import { AddressDetailModal } from '../../../../features/addresses/components/AddressDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import ExcelJS from 'exceljs';
import { useToast } from '../../../../features/context/ToastContext';
import { formatPhoneNumber } from '../../../../lib/utils/phoneUtils';
import { formatZipCode } from '../../../../lib/utils/zipCodeUtils';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';
import { validateAddressImportRow } from '../../../../features/addresses/logic/address-import-validator';

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
    const { addresses, addAddress, updateAddress, deleteAddress, deleteManyAddresses, areas, handleCRUDError } = useData();
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
        searchKeys: ['addressCode', 'officeName', 'division', 'area', 'tel', 'fax', 'zipCode', 'address', 'mainPerson', 'branchNumber', 'specialNote', 'labelName', 'labelZip', 'labelAddress', 'notes', 'attentionNote'], // Broad search
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

    // New Header Order
    const headers = [
        '事業所コード(必須)', '事業所名(必須)', 'エリアコード', 'No.',
        '〒(必須)', '住所(必須)', 'TEL', 'FAX',
        '事業部', '経理コード', 'エリアコード(確認用)', '主担当', '枝番', '※', '備考',
        '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '注意書き'
    ];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // Header is on 2nd row (index 1)
        onValidate: async (rows, fileHeaders) => {
            // Check for required headers
            const requiredHeaders = [
                '事業所コード(必須)', '事業所名(必須)', '〒(必須)', '住所(必須)'
            ];
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
            const existingNames = new Set(addresses.map(a => a.officeName));
            const processedCodes = new Set<string>();
            const processedNames = new Set<string>();
            const errors: string[] = [];

            const importData: any[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                // Check if row is empty
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const { errors: rowErrors, data: newAddress } = validateAddressImportRow(row, fileHeaders, i, existingCodes, processedCodes, existingNames, processedNames);

                if (rowErrors.length > 0) {
                    errors.push(...rowErrors);
                    continue;
                }

                if (newAddress) {
                    processedCodes.add(newAddress.addressCode);
                    processedNames.add(newAddress.officeName);
                    importData.push(newAddress);
                }
            }

            // All-or-Nothing check
            if (errors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="font-bold text-red-600 mb-2">エラーが存在するため、インポートを中止しました。</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
                        </div>
                    ),
                    confirmText: '閉じる',
                    cancelText: ''
                });
                return;
            }

            // Execution Phase
            for (const data of importData) {
                try {
                    await addAddress(data as any, true, true, true);
                    successCount++;
                } catch (error: any) {
                    const errorMsg = error.message === 'DuplicateError' ? '競合エラー' : (error.message || '不明なエラー');
                    errors.push(`登録エラー: ${data.addressCode} - ${errorMsg}`);
                    errorCount++;
                }
            }

            if (errors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
                        </div>
                    ),
                    confirmText: 'OK',
                    cancelText: ''
                });
            }

            if (successCount > 0 && errorCount === 0) {
                showToast(`インポート完了 - 成功: ${successCount}件 / 失敗: ${errorCount}件`, 'success');
            }
        }
    });

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Address) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Address) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にこの住所を削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteAddress(item.id, item.version, false, true);
            } catch (error: any) {
                // console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件の住所を削除しますか？`,
            confirmText: 'Delete',
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
            message: `事業所マスタのエクスポート: ${filteredData.length}件`
        });

        handleExport(filteredData, headers, `address_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => {
            return [
                item.addressCode || '',
                item.officeName || '',
                item.area || '',
                item.no || '',
                item.zipCode || '',
                item.address || '',
                formatPhoneNumber(item.tel || ''),
                formatPhoneNumber(item.fax || ''),
                item.division || '',
                item.accountingCode || '',
                item.area || '', // エリアコード(確認用)
                item.mainPerson || '',
                item.branchNumber || '',
                item.specialNote || '',
                item.notes || '',
                item.labelName || '',
                item.labelZip || '',
                item.labelAddress || '',
                item.attentionNote || ''
            ];
        });
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Headers
        const topHeader = [
            '基本情報', '', '', '', // A-D
            '連絡先情報', '', '', '', // E-H
            '詳細情報', '', '', '', '', '', '', // I-O
            '宛名ラベル情報', '', '', '' // P-S
        ];

        // Add rows
        worksheet.addRow(topHeader);
        worksheet.addRow(headers);

        // Merge cells
        worksheet.mergeCells('A1:D1'); // Basic Info
        worksheet.mergeCells('E1:H1'); // Contact Info
        worksheet.mergeCells('I1:O1'); // Detail Info
        worksheet.mergeCells('P1:S1'); // Label Info

        // Styling Top Header (Row 1)
        const topRow = worksheet.getRow(1);
        topRow.height = 30; // 16px font fits well in 30
        topRow.font = { name: 'Yu Gothic', bold: true, size: 16 };
        topRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Colors for Top Header
        // Orange, Accent 6, White + 60%: FFFCE4D6
        // Olive, Accent 3, White + 60%: FFE2EFDA
        // Aqua, Accent 5, White + 60%: FFDDEBF7
        // Purple, Accent 4, White + 60%: FFE4DFEC

        // Basic Info (A1-D1)
        ['A1', 'B1', 'C1', 'D1'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Contact Info (E1-H1)
        ['E1', 'F1', 'G1', 'H1'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Detail Info (I1-O1)
        ['I1', 'J1', 'K1', 'L1', 'M1', 'N1', 'O1'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Label Info (P1-S1)
        ['P1', 'Q1', 'R1', 'S1'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4DFEC' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Styling Main Headers (Row 2)
        const headerRow = worksheet.getRow(2);
        headerRow.font = { name: 'Yu Gothic', bold: true, size: 11 };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Background: White, Background 1, Darker 15% -> D9D9D9
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9D9D9' }
            };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Format numeric/string columns as text to prevent scientific notation etc.
        // A: Code, B: Name, C: AreaCode, D: No, E: Zip, F: Address, G: Tel, H: Fax
        // I: Division, J: AccCode, K: AreaCheck, L: MainPerson, M: Branch, N: Special
        // O: Notes, P: LabelName, Q: LabelZip, R: LabelAddress, S: Attention

        // Columns needing Text format (Code-like):
        // A(1), C(3), D(4), E(5), G(7), H(8), J(10), K(11), M(13), Q(17)
        [1, 3, 4, 5, 7, 8, 10, 11, 13, 17].forEach(colIndex => {
            worksheet.getColumn(colIndex).numFmt = '@';
        });

        // Set column widths
        worksheet.columns.forEach(col => {
            col.width = 18;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a') as HTMLAnchorElement;
        a.href = url;
        a.download = '事業所マスタエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
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
                <h1 className="text-2xl font-bold text-text-main">事業所マスタ</h1>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted z-10" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    )}
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
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('addressCode')}>事業所コード{getSortIcon('addressCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.addressCode}</button> },
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '事業所 編集' : '事業所 新規登録'}>
                <AddressForm initialData={editingItem} onSubmit={async (data) => {
                    try {
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
                    } catch (error: any) {
                        // console.error(error);
                        handleCRUDError('addresses', error, true);
                    }
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
