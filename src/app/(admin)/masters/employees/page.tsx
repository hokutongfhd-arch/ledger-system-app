'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../../features/context/DataContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { Pagination } from '../../../../components/ui/Pagination';
import { Table } from '../../../../components/ui/Table';
import type { Employee } from '../../../../features/employees/employee.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { NotificationModal } from '../../../../components/ui/NotificationModal';
import { EmployeeForm } from '../../../../features/forms/EmployeeForm';
import * as XLSX from 'xlsx';
import { UserDeviceList } from '../../../../features/components/UserDeviceList';

type SortKey = 'code' | 'role';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

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
    const { employees, addEmployee, updateEmployee, deleteEmployee, addLog, areas, addresses } = useData();
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Employee | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Employee | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);

    const [notification, setNotification] = useState<{
        isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void;
    }>({ isOpen: false, title: '通知', message: '', type: 'alert' });

    const closeNotification = () => setNotification(prev => ({ ...prev, isOpen: false }));
    const showNotification = (message: string, type: 'alert' | 'confirm' = 'alert', onConfirm?: () => void, title: string = '通知') => {
        setNotification({ isOpen: true, title, message, type, onConfirm });
    };

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Employee) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Employee) => {
        showNotification('本当に削除しますか？', 'confirm', async () => {
            try {
                await deleteEmployee(item.id);
                await addLog('employees', 'delete', `社員削除: ${item.code}`);
            } catch (error) {
                showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
            }
        });
    };

    const handleExportCSV = () => {
        const headers = [
            '社員コード', '性別', '氏名', '氏名カナ', '生年月日', '年齢',
            'エリアコード', '住所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '職種', '役付', '社員区分', '給与区分', '原価区分', '権限', 'パスワード'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.code,
                item.gender || '',
                item.name,
                item.nameKana || '',
                item.birthDate || '',
                item.age || '',
                item.areaCode || '',
                item.addressCode || '',
                item.joinDate || '',
                item.yearsOfService || '',
                item.monthsHasuu || '',
                item.jobType || '',
                item.roleTitle || '',
                item.employeeType || '',
                item.salaryType || '',
                item.costType || '',
                item.role === 'admin' ? '管理者' : 'ユーザー',
                item.password || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `employee_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            '社員コード', '性別', '氏名', '氏名カナ', '生年月日', '年齢',
            'エリアコード', '住所コード', '入社年月日', '勤続年数', '勤続端数月数',
            '職種', '役付', '社員区分', '給与区分', '原価区分', '権限', 'パスワード'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '社員マスタエクセルフォーマット.xlsx');
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
                '社員コード', '性別', '氏名', '氏名カナ', '生年月日', '年齢',
                'エリアコード', '住所コード', '入社年月日', '勤続年数', '勤続端数月数',
                '職種', '役付', '社員区分', '給与区分', '原価区分', '権限', 'パスワード'
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

                const parseNumber = (val: any) => {
                    const parsed = parseInt(String(val || ''));
                    return isNaN(parsed) ? 0 : parsed;
                };

                const newEmployee: Omit<Employee, 'id'> & { id?: string } = {
                    code: String(rowData['社員コード'] || ''),
                    gender: String(rowData['性別'] || ''),
                    name: String(rowData['氏名'] || ''),
                    nameKana: String(rowData['氏名カナ'] || ''),
                    birthDate: formatDate(rowData['生年月日']),
                    age: parseNumber(rowData['年齢']),
                    areaCode: String(rowData['エリアコード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    joinDate: formatDate(rowData['入社年月日']),
                    yearsOfService: parseNumber(rowData['勤続年数']),
                    monthsHasuu: parseNumber(rowData['勤続端数月数']),
                    jobType: String(rowData['職種'] || ''),
                    roleTitle: String(rowData['役付'] || ''),
                    employeeType: String(rowData['社員区分'] || ''),
                    salaryType: String(rowData['給与区分'] || ''),
                    costType: String(rowData['原価区分'] || ''),
                    role: String(rowData['権限'] || '') === '管理者' ? 'admin' : 'user',
                    password: String(rowData['パスワード'] || ''),
                    companyNo: '',
                    departmentCode: '',
                    email: ''
                };

                try {
                    await addEmployee(newEmployee as Omit<Employee, 'id'>);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('employees', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
            }

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const filteredData = employees.filter(item =>
        [item.code, item.name, item.nameKana].some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = a[key as keyof Employee];
            let valB: any = b[key as keyof Employee];

            if (key === 'code') {
                const numA = parseInt(String(valA || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB || '').replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) return order === 'asc' ? numA - numB : numB - numA;
            } else if (key === 'role') {
                valA = a.role === 'admin' ? 0 : 1;
                valB = b.role === 'admin' ? 0 : 1;
                if (valA !== valB) return order === 'asc' ? valA - valB : valB - valA;
            }
        }
        return 0;
    });

    const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">社員マスタ</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" id="fileInput" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
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
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
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
                canDelete={() => isAdmin}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedData.length / pageSize)} totalItems={sortedData.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedData.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '社員 編集' : '社員 新規登録'}>
                <EmployeeForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) await updateEmployee({ ...data, id: editingItem.id } as Employee);
                    else await addEmployee(data as Omit<Employee, 'id'>);
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} isSelfEdit={editingItem?.id === user?.id} />
            </Modal>

            <Modal isOpen={!!detailItem} onClose={() => setDetailItem(undefined)} title="社員 詳細">
                {detailItem && (
                    <div className="space-y-8">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">社員コード</label><div className="text-gray-900">{detailItem.code}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">性別</label><div className="text-gray-900">{detailItem.gender || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">氏名</label><div className="text-gray-900">{detailItem.name}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">氏名カナ</label><div className="text-gray-900">{detailItem.nameKana || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">生年月日</label><div className="text-gray-900">{detailItem.birthDate || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">年齢</label><div className="text-gray-900">{detailItem.age || '-'}</div></div>
                            </div>
                        </div>

                        {/* Work Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">所属・勤務情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">エリア名 (エリアコード)</label>
                                    <div className="text-gray-900">
                                        {areas.find(a => a.areaCode === detailItem.areaCode)?.areaName || '-'}
                                        {detailItem.areaCode && ` (${detailItem.areaCode})`}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所 (住所コード)</label>
                                    <div className="text-gray-900">
                                        {addresses.find(a => a.addressCode === detailItem.addressCode)?.officeName || '-'}
                                        {detailItem.addressCode && ` (${detailItem.addressCode})`}
                                    </div>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">入社年月日</label><div className="text-gray-900">{detailItem.joinDate || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">勤続年数</label><div className="text-gray-900">{detailItem.yearsOfService || 0}年</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">勤続端数月数</label><div className="text-gray-900">{detailItem.monthsHasuu || 0}ヶ月</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">職種</label><div className="text-gray-900">{detailItem.jobType || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">役付</label><div className="text-gray-900">{detailItem.roleTitle || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">社員区分</label><div className="text-gray-900">{detailItem.employeeType || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">給与区分</label><div className="text-gray-900">{detailItem.salaryType || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">原価区分</label><div className="text-gray-900">{detailItem.costType || '-'}</div></div>
                            </div>
                        </div>

                        {/* System Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">システム情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">権限</label>
                                    <div className="text-gray-900">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${detailItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {detailItem.role === 'admin' ? '管理者' : 'ユーザー'}
                                        </span>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500 mb-1">パスワード</label>
                                        <div className="text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                                            {detailItem.password || '(未設定)'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Other Info (Devices) */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">貸与デバイス</h3>
                            <div className="pt-2">
                                <UserDeviceList targetCode={detailItem.code} targetName={detailItem.name} />
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
