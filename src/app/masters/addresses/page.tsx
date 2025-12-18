'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Address } from '../../../features/addresses/address.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { AddressForm } from '../../../features/forms/AddressForm';
import { AddressDeviceList } from '../../../features/components/AddressDeviceList';

import { Layout } from '../../../components/layout/Layout';

type SortKey = 'addressCode' | 'tel' | 'fax' | 'zipCode';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export default function AddressListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <Layout>
            <AddressListContent />
        </Layout>
    );
}

function AddressListContent() {
    const { addresses, addAddress, updateAddress, deleteAddress, addLog, areas } = useData();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Address | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Address | undefined>(undefined);
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
    const handleEdit = (item: Address) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Address) => {
        showNotification('本当に削除しますか？', 'confirm', async () => {
            try {
                await deleteAddress(item.id);
                await addLog('addresses', 'delete', `住所削除: ${item.addressCode}`);
            } catch (error) {
                showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
            }
        });
    };

    const filteredData = addresses.filter(item =>
        Object.values(item).some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = a[key as keyof Address];
            let valB: any = b[key as keyof Address];

            if (key === 'addressCode') {
                const partsA = (valA || '').split('-');
                const partsB = (valB || '').split('-');
                const firstA = parseInt(partsA[0]) || 0;
                const firstB = parseInt(partsB[0]) || 0;
                if (firstA !== firstB) return order === 'asc' ? firstA - firstB : firstB - firstA;
                const secondA = parseInt(partsA[1]) || 0;
                const secondB = parseInt(partsB[1]) || 0;
                if (secondA !== secondB) return order === 'asc' ? secondA - secondB : secondB - secondA;
            } else {
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

    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">住所マスタ</h1>
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

            <Table<Address>
                data={paginatedData}
                columns={[
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('addressCode')}>住所コード{getSortIcon('addressCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.addressCode}</button> },
                    { header: '事業所名', accessor: 'officeName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('tel')}>ＴＥＬ{getSortIcon('tel')}</div>, accessor: 'tel' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('fax')}>ＦＡＸ{getSortIcon('fax')}</div>, accessor: 'fax' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('zipCode')}>〒{getSortIcon('zipCode')}</div>, accessor: 'zipCode' },
                    { header: '住所', accessor: 'address' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={(item) => isAdmin || user?.name === item.mainPerson}
                canDelete={() => isAdmin}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedData.length / pageSize)} totalItems={sortedData.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedData.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? '住所 編集' : '住所 新規登録'}>
                <AddressForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) await updateAddress({ ...data, id: editingItem.id } as Address);
                    else await addAddress(data as Omit<Address, 'id'>, true);
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!detailItem} onClose={() => setDetailItem(undefined)} title="住所 詳細">
                {detailItem && (
                    <div className="space-y-8">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">No.</label><div className="text-gray-900">{detailItem.no || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">住所コード</label><div className="text-gray-900">{detailItem.addressCode}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">事業所名</label><div className="text-gray-900">{detailItem.officeName}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">事業部</label><div className="text-gray-900">{detailItem.division || '-'}</div></div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">エリア名 (エリアコード)</label>
                                    <div className="text-gray-900">
                                        {detailItem.area || '-'}
                                        {(() => {
                                            const matchedArea = areas.find(a => a.areaName === detailItem.area);
                                            return matchedArea ? ` (${matchedArea.areaCode})` : '';
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">連絡先情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">ＴＥＬ</label><div className="text-gray-900">{detailItem.tel || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">ＦＡＸ</label><div className="text-gray-900">{detailItem.fax || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">〒</label><div className="text-gray-900">{detailItem.zipCode || '-'}</div></div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所</label>
                                    <div className="text-gray-900">{detailItem.address}</div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">詳細情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">区分</label><div className="text-gray-900">{detailItem.type || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">主担当</label><div className="text-gray-900">{detailItem.mainPerson || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">枝番</label><div className="text-gray-900">{detailItem.branchNumber || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">※</label><div className="text-gray-900">{detailItem.specialNote || '-'}</div></div>
                            </div>
                        </div>

                        {/* Label Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">宛名ラベル情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル用</label><div className="text-gray-900">{detailItem.labelName || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル用〒</label><div className="text-gray-900">{detailItem.labelZip || '-'}</div></div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">宛名ラベル用住所</label>
                                    <div className="text-gray-900">{detailItem.labelAddress || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Others */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">備考</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">注意書き</label>
                                    <div className="text-gray-900 whitespace-pre-wrap">{detailItem.attentionNote || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <h3 className="text-lg font-bold mb-4">貸与デバイス</h3>
                            <AddressDeviceList addressCode={detailItem.addressCode} />
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
