'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Area } from '../../../../features/areas/area.types';
import { Plus, Download, Search, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { AreaForm } from '../../../../features/areas/components/AreaForm';
import { AreaDetailModal } from '../../../../features/areas/components/AreaDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import ExcelJS from 'exceljs';
import { useToast } from '../../../../features/context/ToastContext';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';

export default function AreaListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return <AreaListContent />;
}

function AreaListContent() {
    const { areas, addArea, updateArea, deleteArea, deleteManyAreas } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const highlightId = searchParams.get('highlight');
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Area | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Area | undefined>(undefined);

    const {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, toggleSort,
        selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
        paginatedData, filteredData,
        isAllSelected
    } = useDataTable<Area>({
        data: areas,
        searchKeys: ['areaCode', 'areaName'],
        sortConfig: {
            areaCode: (a, b) => {
                const numA = parseInt(String(a.areaCode || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.areaCode || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            }
        }
    });

    const { handleExport } = useCSVExport<Area>();
    const headers = ['エリアコード(必須)', 'エリア名(必須)'];

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // Header is on 2nd row
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
            const existingCodes = new Set(areas.map(a => a.areaCode));
            const existingNames = new Set(areas.map(a => a.areaName));
            const processedCodes = new Set<string>();
            const processedNames = new Set<string>();
            const errors: string[] = [];
            let successCount = 0;
            let errorCount = 0;

            const importData: any[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                // Excel Row = i + 1 (data start) + 1 (header) + 1 (title) = i + 3
                const excelRowNumber = i + 3;

                const rowData: any = {};
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const rawCode = String(rowData['エリアコード(必須)'] || '').trim();
                const rawName = String(rowData['エリア名(必須)'] || '').trim();
                let rowHasError = false;

                if (!rawCode) {
                    errors.push(`${excelRowNumber}行目: エリアコード(必須)が未入力です`);
                    rowHasError = true;
                } else if (!/^[0-9]+$/.test(rawCode)) {
                    errors.push(`${excelRowNumber}行目: エリアコード「${rawCode}」に半角数字以外の文字が含まれています`);
                    rowHasError = true;
                }

                if (!rawName) {
                    errors.push(`${excelRowNumber}行目: エリア名(必須)が未入力です`);
                    rowHasError = true;
                }

                const code = rawCode;
                const name = rawName;

                if (!rowHasError) {
                    if (existingCodes.has(code)) {
                        errors.push(`${excelRowNumber}行目: エリアコード「${code}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedCodes.has(code)) {
                        errors.push(`${excelRowNumber}行目: エリアコード「${code}」がファイル内で重複しています`);
                        rowHasError = true;
                    }

                    if (existingNames.has(name)) {
                        errors.push(`${excelRowNumber}行目: エリア名「${name}」は既に存在します`);
                        rowHasError = true;
                    } else if (processedNames.has(name)) {
                        errors.push(`${excelRowNumber}行目: エリア名「${name}」がファイル内で重複しています`);
                        rowHasError = true;
                    }
                }

                if (rowHasError) {
                    continue;
                }

                processedCodes.add(code);
                processedNames.add(name);

                const newArea: Omit<Area, 'id' | 'version' | 'updatedAt'> = {
                    areaCode: code,
                    areaName: name
                };

                importData.push(newArea);
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
                    await addArea(data as any, true, true);
                    successCount++;
                } catch (error: any) {
                    const errorMsg = error.message === 'DuplicateError' ? '競合エラー' : (error.message || '不明なエラー');
                    errors.push(`登録エラー: ${data.areaCode} - ${errorMsg}`);
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
    const handleEdit = (item: Area) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Area) => {
        const confirmed = await confirm({
            title: '確認',
            description: '本当にエリアを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteArea(item.id, item.version, false, true);
            } catch (error: any) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = await confirm({
            title: '確認',
            description: `選択した ${selectedIds.size} 件のエリアを削除しますか？`,
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (confirmed) {
            try {
                await deleteManyAreas(Array.from(selectedIds));
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
            targetType: 'area',
            targetId: 'area_list',
            result: 'success',
            message: `エリアマスタのエクスポート: ${filteredData.length}件`
        });

        handleExport(filteredData, headers, `area_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => [
            item.areaCode,
            item.areaName
        ]);
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Headers
        const topHeader = ['基本情報', ''];
        worksheet.addRow(topHeader);
        worksheet.addRow(headers);

        // Merge cells for top header (A1:B1)
        worksheet.mergeCells('A1:B1');

        // Styling Top Header (Row 1)
        const topRow = worksheet.getRow(1);
        topRow.height = 30;
        topRow.font = { name: 'Yu Gothic', bold: true, size: 16 };
        topRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // Apply background color to A1-B1 (Merged)
        // Note: When merging, styling the top-left cell (A1) applies to the merged area usually, 
        // but applying to all involved cells is safer for borders/fills.
        ['A1', 'B1'].forEach(cellRef => {
            const cell = worksheet.getCell(cellRef);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } }; // Orange
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Styling Column Headers (Row 2)
        const headerRow = worksheet.getRow(2);
        headerRow.font = { name: 'Yu Gothic', bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        for (let i = 1; i <= headers.length; i++) {
            const cell = worksheet.getCell(2, i);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; // Gray
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }

        // Format code column as text (Column A)
        worksheet.getColumn(1).numFmt = '@';

        // Set column widths
        worksheet.columns.forEach(col => {
            col.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a') as HTMLAnchorElement;
        a.href = url;
        a.download = 'エリアマスタエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const isAdmin = user?.role === 'admin';

    const getSortIcon = (key: keyof Area) => {
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

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">エリアマスタ</h1>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted z-10" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            <Table<Area>
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('areaCode')}>エリアコード{getSortIcon('areaCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.areaCode}</button> },
                    { header: 'エリア名', accessor: 'areaName' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={() => isAdmin}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'エリア 編集' : 'エリア 新規登録'}>
                <AreaForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateArea({ ...data, id: editingItem.id } as Area);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addArea(data as Omit<Area, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <AreaDetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                item={detailItem}
            />

            <ConfirmDialog />
        </div>
    );
}
