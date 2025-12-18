'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { FeaturePhone } from '../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { FeaturePhoneForm } from '../../../features/forms/FeaturePhoneForm';
import { Layout } from '../../../components/layout/Layout';

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

    return (
        <Layout>
            <FeaturePhoneListContent />
        </Layout>
    );
}

function FeaturePhoneListContent() {
    const { featurePhones, addFeaturePhone, updateFeaturePhone, deleteFeaturePhone, addLog, employees, addresses } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FeaturePhone | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<FeaturePhone | undefined>(undefined);
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
    const handleEdit = (item: FeaturePhone) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: FeaturePhone) => {
        showNotification('本当に削除しますか？', 'confirm', async () => {
            try {
                await deleteFeaturePhone(item.id, true);
                await addLog('featurePhones', 'delete', `ガラホ削除: ${item.managementNumber}`);
            } catch (error) {
                showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
            }
        });
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

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">ガラホ管理台帳</h1>
                <div className="flex gap-2">
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
                columns={[
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('managementNumber')}>管理番号{getSortIcon('managementNumber')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.managementNumber}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('modelName')}>機種名{getSortIcon('modelName')}</div>, accessor: 'modelName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('phoneNumber')}>電話番号{getSortIcon('phoneNumber')}</div>, accessor: 'phoneNumber' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeId)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('lendDate')}>貸与日{getSortIcon('lendDate')}</div>, accessor: 'lendDate' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: 'contractYears' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedData.length / pageSize)} totalItems={sortedData.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedData.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'ガラホ 編集' : 'ガラホ 新規登録'}>
                <FeaturePhoneForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) await updateFeaturePhone({ ...data, id: editingItem.id } as FeaturePhone, true);
                    else await addFeaturePhone(data as Omit<FeaturePhone, 'id'>, true);
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!detailItem} onClose={() => setDetailItem(undefined)} title="ガラホ 詳細">
                {detailItem && (
                    <div className="space-y-8">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">管理番号</label><div className="text-gray-900">{detailItem.managementNumber}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">機種名</label><div className="text-gray-900">{detailItem.modelName}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">電話番号</label><div className="text-gray-900">{detailItem.phoneNumber}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">キャリア</label><div className="text-gray-900">{detailItem.carrier || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">契約年数</label><div className="text-gray-900">{detailItem.contractYears || '-'}</div></div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">社員名 (社員コード)</label>
                                    <div className="text-gray-900">
                                        {employees.find(e => e.code === detailItem.employeeId)?.name || '-'}
                                        {detailItem.employeeId && ` (${detailItem.employeeId})`}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所(住所コード)</label>
                                    <div className="text-gray-900">
                                        {addresses.find(a => a.addressCode === detailItem.addressCode)?.officeName || '-'}
                                        {detailItem.addressCode && ` (${detailItem.addressCode})`}
                                    </div>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">貸与日</label><div className="text-gray-900">{detailItem.lendDate || '-'}</div></div>
                            </div>
                        </div>

                        {/* Admin Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">管理情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">負担先会社</label><div className="text-gray-900">{detailItem.costCompany || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">受領書提出日</label><div className="text-gray-900">{detailItem.receiptDate || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">返却日</label><div className="text-gray-900">{detailItem.returnDate || '-'}</div></div>
                            </div>
                        </div>

                        {/* Others */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-500 mb-1">備考1</label><div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div></div>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
