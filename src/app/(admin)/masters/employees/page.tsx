'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Employee } from '../../../../features/employees/employee.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
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

export default function EmployeeListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

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
        onValidate: async (rows, headers) => {
            const requiredHeaders = [
                '社員コード', '性別', '苗字', '名前', '苗字カナ', '名前カナ', 'メールアドレス', '生年月日', '年齢',
                'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
                '権限', 'パスワード'
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
            const processedCodes = new Set<string>();
            const importData: Employee[] = [];
            const validationErrors: string[] = [];

            // 1. Parse all rows into Employee objects first
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                const isRowEmpty = row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '');
                if (isRowEmpty) continue;

                const rowData: any = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                const toHalfWidth = (str: string) => {
                    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                };

                const rawCode = String(rowData['社員コード'] || '');
                const code = toHalfWidth(rawCode).trim();

                // Duplicate check within file only
                if (processedCodes.has(code)) {
                    // We skip duplicates in file to prevent double-processing same ID twice in one batch
                    validationErrors.push(`${i + 2}行目: 社員コード「${code}」がファイル内で重複しています`);
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

                const parseNumber = (val: any) => {
                    const parsed = parseInt(String(val || ''));
                    return isNaN(parsed) ? 0 : Math.max(0, parsed);
                };

                const birthDateValue = formatDate(rowData['生年月日']);
                const joinDateValue = formatDate(rowData['入社年月日']);

                if (birthDateValue && joinDateValue && new Date(birthDateValue) > new Date(joinDateValue)) {
                    validationErrors.push(`${i + 2}行目: 入社年月日（${joinDateValue}）は生年月日（${birthDateValue}）以降である必要があります`);
                    continue;
                }

                const lastName = String(rowData['苗字'] || rowData['氏名'] || '').trim();
                const firstName = String(rowData['名前'] || '').trim();
                const lastNameKana = String(rowData['苗字カナ'] || rowData['氏名カナ'] || '').trim();
                const firstNameKana = String(rowData['名前カナ'] || '').trim();
                const rawPassword = String(rowData['パスワード'] || '').trim();
                const password = toHalfWidth(rawPassword);

                // Password Validation (8+ digits, numeric only)
                const passwordErrors = [];
                if (password.length < 8) {
                    passwordErrors.push('パスワードは8文字以上である必要があります');
                }
                if (!/^[0-9]+$/.test(password)) {
                    passwordErrors.push('パスワードは半角数字のみ使用可能です');
                }

                if (passwordErrors.length > 0) {
                    passwordErrors.forEach(err => {
                        validationErrors.push(`${i + 2}行目: ${err}`);
                    });
                    continue;
                }

                // スペースを除去し、半角スペースで結合
                const cleanName = `${lastName.replace(/[\s　]+/g, '')} ${firstName.replace(/[\s　]+/g, '')}`.trim();
                const cleanNameKana = `${lastNameKana.replace(/[\s　]+/g, '')} ${firstNameKana.replace(/[\s　]+/g, '')}`.trim();

                const emp: Omit<Employee, 'id'> & { id?: string } = {
                    code: code,
                    gender: String(rowData['性別'] || ''),
                    name: cleanName,
                    nameKana: cleanNameKana,
                    birthDate: birthDateValue,
                    age: parseNumber(rowData['年齢']),
                    areaCode: toHalfWidth(String(rowData['エリアコード'] || '')).trim(),
                    addressCode: toHalfWidth(String(rowData['事業所コード'] || '')).trim(),
                    joinDate: joinDateValue,
                    yearsOfService: parseNumber(rowData['勤続年数']),
                    monthsHasuu: parseNumber(rowData['勤続端数月数']),
                    role: String(rowData['権限'] || '') === '管理者' ? 'admin' : 'user',
                    password: password,
                    companyNo: '',
                    departmentCode: toHalfWidth(String(rowData['部署コード'] || '')).trim(),
                    email: String(rowData['メールアドレス'] || '').trim()
                };

                importData.push(emp as Employee);
                processedCodes.add(code);
            }

            // If there are validation errors from parsing, show them and stop.
            if (validationErrors.length > 0) {
                await confirm({
                    title: 'インポートエラー',
                    description: (
                        <div className="max-h-60 overflow-y-auto">
                            <p className="mb-2">以下のデータは処理されませんでした：</p>
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

                if (result.failureCount === 0) {
                    showToast(`インポート成功: ${result.successCount}件`, 'success');
                } else {
                    await confirm({
                        title: 'インポート完了 (一部エラー)',
                        description: (
                            <div className="max-h-60 overflow-y-auto">
                                <p className="mb-2">{result.successCount}件成功, {result.failureCount}件失敗</p>
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
            '社員コード', '性別', '苗字', '名前', '苗字カナ', '名前カナ', 'メールアドレス', '生年月日', '年齢',
            'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '権限', 'パスワード'
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
                item.yearsOfService || '',
                item.monthsHasuu || '',
                item.role === 'admin' ? '管理者' : 'ユーザー',
                item.password || ''
            ];
        });
    };

    const handleDownloadTemplate = async () => {
        const headers = [
            '社員コード', '性別', '苗字', '名前', '苗字カナ', '名前カナ', 'メールアドレス', '生年月日', '年齢',
            'エリアコード', '事業所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '権限', 'パスワード'
        ];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        // Add headers
        worksheet.addRow(headers);

        // Styling headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Set column widths
        worksheet.columns.forEach(col => {
            col.width = 20;
        });

        // Data Validation for 性別 (Column B)
        for (let i = 2; i <= 100; i++) {
            worksheet.getCell(`B${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"男性,女性"']
            };
        }

        // Data Validation for 権限 (Column N)
        for (let i = 2; i <= 100; i++) {
            worksheet.getCell(`N${i}`).dataValidation = {
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
                    <button onClick={async () => {
                        // 1. Diagnose first
                        const diag = await diagnoseEmployeeStateAction('7300');

                        if (diag.data?.inDatabase && (diag.data?.inAuth?.length ?? 0) === 0) {
                            // Case 1: DB exists, Auth missing -> Force DB Delete
                            const confirmed = await confirm({
                                title: 'Force Cleanup 7300',
                                description: (
                                    <div>
                                        <p className="font-bold mb-2 text-red-600">State: DB Record Only</p>
                                        <p>DB record exists but Auth is missing.</p>
                                        <p>Force Delete DB record?</p>
                                    </div>
                                ),
                                confirmText: 'FORCE DB DELETE',
                                cancelText: 'Cancel',
                                variant: 'destructive'
                            });

                            if (confirmed) {
                                const res = await forceDeleteEmployeeByCodeAction('7300');
                                if (res.success) {
                                    showToast('DB Record Deleted. Please re-register.', 'success');
                                    window.location.reload();
                                } else {
                                    showToast('Delete Failed: ' + res.error, 'error');
                                }
                            }
                        } else if (!diag.data?.inDatabase && (diag.data?.inAuth?.length ?? 0) > 0) {
                            // Case 2: DB missing, Auth exists -> Force Auth Delete
                            const confirmed = await confirm({
                                title: 'Force Cleanup 7300',
                                description: (
                                    <div>
                                        <p className="font-bold mb-2 text-red-600">State: Auth User Only (Orphan)</p>
                                        <p>Auth Users found but DB record is gone.</p>
                                        <p>Force Delete {diag.data?.inAuth?.length ?? 0} Auth Users?</p>
                                    </div>
                                ),
                                confirmText: 'FORCE AUTH DELETE',
                                cancelText: 'Cancel',
                                variant: 'destructive'
                            });

                            if (confirmed) {
                                const res = await deleteOrphanedAuthUserAction('7300');
                                if (res.success) {
                                    showToast('Auth Users Deleted. Please re-register.', 'success');
                                    window.location.reload();
                                } else {
                                    showToast('Delete Failed: ' + res.error, 'error');
                                }
                            }
                        } else {
                            // Case 3: Both exist or neither (or messy)
                            showToast(`Diagnostic: DB=${!!diag.data?.inDatabase}, Auth=${diag.data?.inAuth?.length ?? 0}`, 'info');
                            if (diag.data?.inDatabase && (diag.data?.inAuth?.length ?? 0) > 0) {
                                // Both exist - suggest regular delete? Or allow Force Both?
                                // For now, simple info is likely enough as regular delete should work if synced, 
                                // preventing deletion if auth_id mismatch is blocked.
                            }
                        }
                    }} className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Debug: Fix 7300 Error</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    {isAdmin && <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>}
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
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
