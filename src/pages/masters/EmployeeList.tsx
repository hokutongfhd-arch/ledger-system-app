
import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { Table } from '../../components/ui/Table';
import type { Employee } from '../../types';
import { Plus, Download, FileSpreadsheet, Upload, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/ui/Modal';
import { EmployeeForm } from '../../components/forms/EmployeeForm';
import { DetailModal } from '../../components/ui/DetailModal';

import { useAuth } from '../../context/AuthContext';
import { toFullWidthKana } from '../../utils/stringUtils';

export const EmployeeList = () => {
    const { employees, addEmployee, updateEmployee, deleteEmployee, addLog } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Employee | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Employee | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleAdd = () => {
        setEditingItem(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (item: Employee) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (item: Employee) => {
        if (window.confirm('本当に削除しますか？')) {
            try {
                await deleteEmployee(item.id);
            } catch (error) {
                console.error(error);
                alert('削除に失敗しました。');
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm('本当に削除しますか')) {
            try {
                for (const id of selectedIds) {
                    await deleteEmployee(id);
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
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    };

    const handleSubmit = async (data: Omit<Employee, 'id'>) => {
        try {
            if (editingItem) {
                await updateEmployee({ ...data, id: editingItem.id });
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
                await addEmployee(data);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました。サーバーが起動しているか確認してください。');
        }
    };

    const canEdit = (targetEmployee: Employee) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.id === targetEmployee.id;
    };

    const canDelete = (_: Employee) => {
        return user?.role === 'admin';
    };

    const getRowClassName = (item: Employee) => {
        if (item.id === searchParams.get('highlight')) {
            return 'bg-accent-coral/10';
        }
        return '';
    };

    const handleDownloadTemplate = () => {
        const headers = [
            '社員コード', 'パスワード', '氏名', '氏名カナ', '性別', '生年月日',
            '入社年月日', '当月末満年齢', '勤続年数', '勤続端数月数', '社員区分',
            '給与区分', '原価区分', 'エリアコード', '住所コード', '役付', '職種', '権限'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '社員マスタエクセルフォーマット.xlsx');
    };

    const handleExportCSV = () => {
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        const filename = `社員マスタ${formattedDate}.csv`;

        const headers = [
            'ID', '社員コード', 'パスワード', '氏名', '氏名カナ', '性別', '生年月日',
            '入社年月日', '当月末満年齢', '勤続年数', '勤続端数月数', '社員区分',
            '給与区分', '原価区分', 'エリアコード', '住所コード', '役付', '職種', '権限'
        ];

        const csvContent = [
            headers.join(','),
            ...employees.map(item => [
                item.id,
                item.code,
                item.password || '',
                item.name,
                item.nameKana,
                item.gender || '',
                item.birthDate || '',
                item.joinDate || '',
                item.age || 0,
                item.yearsOfService || 0,
                item.monthsHasuu || 0,
                item.employeeType || '',
                item.salaryType || '',
                item.costType || '',
                item.areaCode || '',
                item.addressCode || '',
                item.roleTitle || '',
                item.jobType || '',
                item.role
            ].map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
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
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const headerMap: Record<string, keyof Omit<Employee, 'id'>> = {
                    '社員コード': 'code',
                    'パスワード': 'password',
                    '氏名': 'name',
                    '氏名カナ': 'nameKana',
                    '性別': 'gender',
                    '生年月日': 'birthDate',
                    '入社年月日': 'joinDate',
                    '当月末満年齢': 'age',
                    '勤続年数': 'yearsOfService',
                    '勤続端数月数': 'monthsHasuu',
                    '社員区分': 'employeeType',
                    '給与区分': 'salaryType',
                    '原価区分': 'costType',
                    'エリアコード': 'areaCode',
                    '住所コード': 'addressCode',
                    '役付': 'roleTitle',
                    '職種': 'jobType',
                    '権限': 'role'
                };

                const validHeaders = Object.keys(headerMap);

                if (data.length === 0) {
                    alert('データがありません。');
                    return;
                }

                const firstRow = data[0] as object;
                const invalidColumns = Object.keys(firstRow).filter(key => !validHeaders.includes(key));

                if (invalidColumns.length > 0) {
                    alert(`不正なカラムが含まれています: ${invalidColumns.join(', ')}`);
                    return;
                }

                let successCount = 0;
                for (const row of data) {
                    const employeeData: any = {};
                    Object.entries(row as object).forEach(([key, value]) => {
                        const englishKey = headerMap[key];
                        if (englishKey) {
                            let processedValue = value;

                            if (englishKey === 'gender') {
                                if (value === 1 || value === '1') processedValue = '男性';
                                else if (value === 2 || value === '2') processedValue = '女性';
                            }

                            if (englishKey === 'nameKana' && typeof value === 'string') {
                                processedValue = toFullWidthKana(value);
                            }

                            if (englishKey === 'role') {
                                if (value === '管理者') processedValue = 'admin';
                                else if (value === 'ユーザー') processedValue = 'user';
                                else if (value !== 'admin' && value !== 'user') processedValue = 'user';
                            }

                            if ((englishKey === 'birthDate' || englishKey === 'joinDate') && value) {
                                if (value instanceof Date) {
                                    const y = value.getFullYear();
                                    const m = String(value.getMonth() + 1).padStart(2, '0');
                                    const d = String(value.getDate()).padStart(2, '0');
                                    processedValue = `${y}-${m}-${d}`;
                                } else if (typeof value === 'string') {
                                    const parts = value.split('/');
                                    if (parts.length === 3) {
                                        const y = parts[0];
                                        const m = parts[1].padStart(2, '0');
                                        const d = parts[2].padStart(2, '0');
                                        processedValue = `${y}-${m}-${d}`;
                                    }
                                }
                            }

                            employeeData[englishKey] = processedValue;
                        }
                    });

                    if (!employeeData.code || !employeeData.name) {
                        continue;
                    }

                    if (employeeData.role !== 'admin' && employeeData.role !== 'user') {
                        employeeData.role = 'user';
                    }

                    await addEmployee(employeeData as Omit<Employee, 'id'>, true);
                    successCount++;
                }

                if (successCount > 0) {
                    await addLog('employees', 'import', `Excelインポート: ${successCount}件追加`);
                }

                alert(`${successCount}件のインポートが完了しました。`);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('インポート中にエラーが発生しました。');
            }
        };
        reader.readAsBinaryString(file);
    };

    const isAdmin = user?.role === 'admin';

    // Define all detail labels
    const detailLabels: Record<string, string> = {
        code: '社員コード',
        password: 'パスワード',
        name: '氏名',
        nameKana: '氏名カナ',
        gender: '性別',
        birthDate: '生年月日',
        joinDate: '入社年月日',
        age: '当月末満年齢',
        yearsOfService: '勤続年数',
        monthsHasuu: '勤続端数月数',
        employeeType: '社員区分',
        salaryType: '給与区分',
        costType: '原価区分',
        areaCode: 'エリアコード',
        addressCode: '住所コード',
        roleTitle: '役付',
        jobType: '職種',
        role: '権限',
    };

    // Filter labels based on role (hide password for non-admins)
    const filteredLabels = { ...detailLabels };
    if (!isAdmin) {
        delete filteredLabels['password'];
    }

    const filteredEmployees = employees.filter(item =>
        (item.code ? String(item.code).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
        (item.name ? String(item.name).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
        (item.nameKana ? String(item.nameKana).toLowerCase() : '').includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
    const totalItems = filteredEmployees.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = filteredEmployees.slice(startIndex, endIndex);

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">社員マスタ</h1>
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
                    {isAdmin && (
                        <button
                            onClick={handleAdd}
                            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-sm"
                        >
                            <Plus size={18} />
                            新規登録
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="検索 (社員コード, 氏名...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-background-subtle text-text-main placeholder-text-muted"
                    />
                </div>
                <button className="text-text-secondary hover:text-text-main p-2 rounded-lg hover:bg-background-subtle">
                    <Filter size={20} />
                </button>
            </div>

            <Table<Employee>
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
                        header: '社員コード', accessor: (item) => (
                            <button
                                onClick={() => setDetailItem(item)}
                                className="text-primary hover:text-primary-hover hover:underline text-left font-medium"
                            >
                                {item.code}
                            </button>
                        )
                    },
                    { header: '氏名', accessor: 'name' },
                    { header: '氏名カナ', accessor: 'nameKana' },
                    {
                        header: '権限', accessor: (item) => (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                {item.role === 'admin' ? '管理者' : 'ユーザー'}
                            </span>
                        )
                    },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={canEdit}
                canDelete={canDelete}
            />

            {/* Footer with Actions and Pagination */}
            <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-4 border-t border-gray-200 mt-auto rounded-b-lg gap-4">
                {/* Left: Result Count */}
                <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start">
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                        {totalItems} 件中 {startIndex + 1} - {endIndex} を表示
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Trash2 size={16} />
                        まとめて削除
                    </button>
                </div>

                {/* Right: Pagination Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronsLeft size={20} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex items-center gap-2 mx-2">
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={currentPage}
                                onChange={(e) => handlePageChange(Number(e.target.value))}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm"
                            />
                            <span className="text-sm text-gray-600 whitespace-nowrap">/ {totalPages} ページ</span>
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronsRight size={20} />
                        </button>
                    </div>

                    <select
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {[15, 30, 50, 100].map(size => (
                            <option key={size} value={size}>{size} 件 / ページ</option>
                        ))}
                    </select>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? '社員 編集' : '社員 新規登録'}
            >
                <EmployeeForm
                    initialData={editingItem}
                    onSubmit={handleSubmit}
                    onCancel={() => setIsModalOpen(false)}
                    isSelfEdit={editingItem?.id === user?.id}
                />
            </Modal>
            <DetailModal
                isOpen={!!detailItem}
                onClose={() => setDetailItem(undefined)}
                title="社員 詳細"
                data={detailItem}
                labels={filteredLabels}
            />
        </div >
    );
};
