'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Employee } from '../../../../features/employees/employee.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { EmployeeForm } from '../../../../features/employees/components/EmployeeForm';
import { EmployeeDetailModal } from '../../../../features/employees/components/EmployeeDetailModal';
import { useConfirm } from '../../../../hooks/useConfirm';
import ExcelJS from 'exceljs';
import { useToast } from '../../../../features/context/ToastContext';
import { useDataTable } from '../../../../hooks/useDataTable';
import { useCSVExport } from '../../../../hooks/useCSVExport';
import { useFileImport } from '../../../../hooks/useFileImport';
import { logger } from '../../../../lib/logger';
import { deleteOrphanedAuthUserAction, diagnoseEmployeeStateAction, forceDeleteEmployeeByCodeAction } from '@/app/actions/admin_maintenance';
import { parseAndValidateEmployees } from '../../../../features/employees/logic/employee-import-validator';

export default function EmployeeListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const isSetup = document.cookie.includes('is_initial_setup=true');
        if (!user && !isSetup) router.push('/login');
    }, [user, router]);

    // Allow render if setup mode (user might be null briefly)
    const isSetupMode = typeof document !== 'undefined' && document.cookie.includes('is_initial_setup=true');
    if (!user && !isSetupMode) return null;

    return <EmployeeListContent />;
}

function EmployeeListContent() {
    const { employees, addEmployee, updateEmployee, deleteEmployee, deleteManyEmployees, areas, addresses } = useData();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const highlightId = searchParams.get('highlight');
    const { user } = useAuth();
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Employee | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Employee | undefined>(undefined);

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
    } = useDataTable<Employee>({
        data: employees,
        searchKeys: ['code', 'name', 'nameKana'],
        sortConfig: {
            code: (a, b) => {
                const numA = parseInt(String(a.code || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(b.code || '').replace(/[^0-9]/g, '')) || 0;
                return numA - numB;
            },
            role: (a, b) => {
                const valA = a.role === 'admin' ? 0 : 1;
                const valB = b.role === 'admin' ? 0 : 1;
                return valA - valB;
            }
        }
    });

    const { handleExport } = useCSVExport<Employee>();

    const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
        headerRowIndex: 1, // Header is on the second row
        onValidate: async (rows, headers) => {
            const requiredHeaders = [
                '社員コード(必須)', '性別', '苗字(必須)', '名前(必須)', '苗字カナ', '名前カナ', 'メールアドレス(必須)', '生年月日', '年齢',
                'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
                '権限(必須)', 'パスワード(必須)'
            ];

            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
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
        onImport: async (rows, headers) => {
            const { validEmployees: importData, errors: validationErrors } = parseAndValidateEmployees(rows, headers);

            // If there are validation errors from parsing, show them and stop.
            if (validationErrors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                            <ul className="list-disc pl-5 text-sm text-red-600">
                                {validationErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                            </ul>
                        </div>
                    ),
                    confirmText: 'OK',
                    cancelText: ''
                });
                return;
            }

            // 2. Call Bulk API
            if (importData.length === 0) {
                showToast('インポート可能なデータがありませんでした', 'error');
                return;
            }

            const loadingToast = showToast('インポート中...', 'loading');

            try {
                const { employeeService } = await import('../../../../features/employees/employee.service');
                const result = await employeeService.saveEmployeesBulk(importData);

                // 1. バリデーションエラー（メール重複など）のチェック
                if (result.validationErrors && result.validationErrors.length > 0) {
                    await confirm({
                        title: 'インポートエラー',
                        description: (
                            <div className="max-h-60 overflow-y-auto">
                                <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                                <ul className="list-disc pl-5 text-sm text-red-600">
                                    {result.validationErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                                </ul>
                            </div>
                        ),
                        confirmText: 'OK',
                        cancelText: ''
                    });
                    return;
                }

                if (result.failureCount === 0) {
                    showToast(`インポート成功: ${result.successCount}件`, 'success');
                } else if (result.successCount === 0) {
                    // All failed
                    await confirm({
                        title: 'インポートエラー',
                        description: (
                            <div className="max-h-60 overflow-y-auto">
                                <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                                <ul className="list-disc pl-5 text-sm text-red-600">
                                    {result.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                </ul>
                            </div>
                        ),
                        confirmText: 'OK',
                        cancelText: ''
                    });
                } else {
                    // Partial success
                    await confirm({
                        title: 'インポート完了 (一部エラー)',
                        description: (
                            <div className="max-h-60 overflow-y-auto">
                                <p className="mb-2 font-bold text-red-600">エラーが存在するため、インポートを中止しました。</p>
                                <ul className="list-disc pl-5 text-sm text-red-600">
                                    {result.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                </ul>
                            </div>
                        ),
                        confirmText: 'OK',
                        cancelText: ''
                    });
                }

                // Refresh data
                window.location.reload(); // Simplest way to refresh list for now

            } catch (e: any) {
                showToast(`インポート予期せぬエラー: ${e.message}`, 'error');
            }
        }
    });

    // -- Handlers --

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Employee) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Employee) => {
        if (item.id === user?.id) {
            await confirm({
                title: '操作不可',
                description: 'ログイン中のアカウントは削除できません。',
                confirmText: 'OK',
                cancelText: ''
            });
            return;
        }

        const confirmed = await confirm({
            title: '確認',
            description: '本当に削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteEmployee(item.id);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        // Exclude current user from deletion targets
        const idsToDelete = Array.from(selectedIds).filter(id => id !== user?.id);
        const includesSelf = idsToDelete.length < selectedIds.size;

        if (idsToDelete.length === 0) {
            await confirm({
                title: '操作不可',
                description: 'ログイン中のアカウントは削除できません。',
                confirmText: 'OK',
                cancelText: ''
            });
            return;
        }

        const message = includesSelf
            ? `ログイン中のアカウントを除く ${idsToDelete.length} 件を削除しますか？`
            : `選択した ${idsToDelete.length} 件を削除しますか？`;

        const confirmed = await confirm({
            title: '確認',
            description: message,
            confirmText: 'Delete',
            variant: 'destructive'
        });

        if (confirmed) {
            try {
                await deleteManyEmployees(idsToDelete);
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
            targetType: 'employee',
            targetId: 'employee_list',
            result: 'success',
            message: `社員マスタのエクスポート: ${filteredData.length}件`
        });

        const headers = [
            '社員コード(必須)', '性別', '苗字(必須)', '名前(必須)', '苗字カナ', '名前カナ', 'メールアドレス(必須)', '生年月日', '年齢',
            'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '権限(必須)', 'パスワード(必須)'
        ];

        handleExport(filteredData, headers, `employee_list_${new Date().toISOString().split('T')[0]}.csv`, (item) => {
            const [lastName, ...firstNameParts] = (item.name || '').split(/[\s　]+/);
            const [lastNameKana, ...firstNameKanaParts] = (item.nameKana || '').split(/[\s　]+/);

            return [
                item.code,
                item.gender || '',
                lastName || '',
                firstNameParts.join(' ') || '',
                lastNameKana || '',
                firstNameKanaParts.join(' ') || '',
                item.email || '',
                item.birthDate || '',
                item.age || '',
                item.areaCode || '',
                item.addressCode || '',
                item.joinDate || '',
                (item.yearsOfService !== undefined && item.yearsOfService !== null) ? `${item.yearsOfService}年` : '',
                item.monthsHasuu || '',
                item.role === 'admin' ? '管理者' : 'ユーザー',
                '********' // Do not export raw password
            ];
        });
    };

    const handleDownloadTemplate = async () => {
        const headers = [
            '社員コード(必須)', '性別', '苗字(必須)', '名前(必須)', '苗字カナ', '名前カナ', 'メールアドレス(必須)', '生年月日', '年齢',
            'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '権限(必須)', 'パスワード(必須)'
        ];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Headers
        const topHeader = [
            '基本情報', '', '', '', '', '', '', '', '',
            '所属・勤務情報', '', '', '', '',
            'システム情報', ''
        ];

        worksheet.addRow(topHeader);
        worksheet.addRow(headers);

        // Merge cells for top header
        worksheet.mergeCells('A1:I1'); // Basic Info (9 columns)
        worksheet.mergeCells('J1:N1'); // Work Info (5 columns)
        worksheet.mergeCells('O1:P1'); // System Info (2 columns)

        // Styling Top Header (Row 1)
        const topRow = worksheet.getRow(1);
        topRow.height = 30; // 16px font approx
        topRow.font = { name: 'Yu Gothic', bold: true, size: 16 };
        topRow.alignment = { vertical: 'middle', horizontal: 'center' };

        const setCellColor = (colStart: number, colEnd: number, color: string) => {
            for (let c = colStart; c <= colEnd; c++) {
                const cell = worksheet.getCell(1, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }
        };

        // Apply background colors
        setCellColor(1, 9, 'FFFCE4D6'); // Orange (Basic)
        setCellColor(10, 14, 'FFEBF1DE'); // Olive (Work)
        setCellColor(15, 16, 'DCE6F1');   // Aqua (System)

        // Styling Column Headers (Row 2)
        const headerRow = worksheet.getRow(2);
        headerRow.font = { name: 'Yu Gothic', bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        for (let i = 1; i <= headers.length; i++) {
            const cell = worksheet.getCell(2, i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' } // Gray
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }

        // Set column widths
        worksheet.columns.forEach(col => {
            col.width = 20;
        });

        // Data Validation for 性別 (Column B)
        for (let i = 3; i <= 100; i++) {
            worksheet.getCell(`B${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"男性,女性"']
            };
        }

        // Data Validation for 権限 (Column O)
        const roleColChar = 'O';
        for (let i = 3; i <= 100; i++) {
            worksheet.getCell(`${roleColChar}${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"管理者,ユーザー"']
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '社員マスタエクセルフォーマット.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getSortIcon = (key: keyof Employee) => {
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
    const rowClassName = (item: Employee) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : '';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">社員マスタ</h1>
                <div className="flex gap-2">
                    {user?.id !== 'INITIAL_SETUP_ACCOUNT' && (
                        <button onClick={handleExportCSVClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    )}
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

            <Table<Employee>
                data={paginatedData}
                rowClassName={rowClassName}
                columns={[
                    {
                        header: <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4" />,
                        accessor: (item) => <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => handleCheckboxChange(item.id)} className="w-4 h-4" />,
                        className: "w-10 px-4"
                    },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('code')}>社員コード{getSortIcon('code')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.code}</button> },
                    { header: '氏名', accessor: 'name' },
                    { header: '氏名カナ', accessor: 'nameKana' },
                    {
                        header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('role')}>権限{getSortIcon('role')}</div>, accessor: (item) => (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                {item.role === 'admin' ? '管理者' : 'ユーザー'}
                            </span>
                        )
                    },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={(item) => isAdmin || user?.id === item.id}
                canDelete={(item) => isAdmin && item.id !== user?.id}
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '社員 編集' : '社員 新規登録'}>
                <EmployeeForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) {
                        await updateEmployee({ ...data, id: editingItem.id } as Employee);
                        if (editingItem.id === highlightId) {
                            const params = new URLSearchParams(searchParams.toString());
                            params.delete('highlight');
                            params.delete('field');
                            router.replace(`${pathname}?${params.toString()}`);
                        }
                    } else {
                        await addEmployee(data as Omit<Employee, 'id'>);
                    }
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} isSelfEdit={editingItem?.id === user?.id} />
            </Modal>

            <EmployeeDetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                item={detailItem}
                areas={areas}
                addresses={addresses}
                isAdmin={isAdmin}
            />

            <ConfirmDialog />
        </div>
    );
}
