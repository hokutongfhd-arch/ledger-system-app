'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Employee } from '../../../features/employees/employee.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { EmployeeForm } from '../../../features/forms/EmployeeForm';
import { UserDeviceList } from '../../../features/components/UserDeviceList';

import { Layout } from '../../../components/layout/Layout';

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

    return (
        <Layout>
            <EmployeeListContent />
        </Layout>
    );
}

function EmployeeListContent() {
    const { employees, addEmployee, updateEmployee, deleteEmployee, addLog, areas, addresses } = useData();
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
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="pt-2">
                                <label className="block text-sm font-bold text-gray-700 mb-3">貸与デバイス</label>
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
