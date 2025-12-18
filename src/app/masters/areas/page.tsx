'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Area } from '../../../features/areas/area.types';
import { Plus, Download, Search, Filter, FileSpreadsheet, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { AreaForm } from '../../../features/forms/AreaForm';
import * as XLSX from 'xlsx';
import { Layout } from '../../../components/layout/Layout';

type SortKey = 'areaCode';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export default function AreaListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <Layout>
            <AreaListContent />
        </Layout>
    );
}

function AreaListContent() {
    const { areas, addArea, updateArea, deleteArea, addLog } = useData();
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Area | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Area | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [notification, setNotification] = useState<{
        isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void;
    }>({ isOpen: false, title: '通知', message: '', type: 'alert' });

    const closeNotification = () => setNotification(prev => ({ ...prev, isOpen: false }));
    const showNotification = (message: string, type: 'alert' | 'confirm' = 'alert', onConfirm?: () => void, title: string = '通知') => {
        setNotification({ isOpen: true, title, message, type, onConfirm });
    };

    const handleAdd = () => { setEditingItem(undefined); setIsModalOpen(true); };
    const handleEdit = (item: Area) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Area) => {
        showNotification('本当に削除しますか？', 'confirm', async () => {
            try {
                await deleteArea(item.id);
                await addLog('areas', 'delete', `エリア削除: ${item.areaCode}`);
            } catch (error) {
                showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
            }
        });
    };

    const filteredData = areas.filter(item =>
        Object.values(item).some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = a[key as keyof Area];
            let valB: any = b[key as keyof Area];

            if (key === 'areaCode') {
                const numA = parseInt(String(valA || '').replace(/[^0-9]/g, '')) || 0;
                const numB = parseInt(String(valB || '').replace(/[^0-9]/g, '')) || 0;
                if (numA !== numB) return order === 'asc' ? numA - numB : numB - numA;
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
                <h1 className="text-2xl font-bold text-text-main">エリアマスタ</h1>
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

            <Table<Area>
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('areaCode')}>エリアコード{getSortIcon('areaCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.areaCode}</button> },
                    { header: 'エリア名', accessor: 'areaName' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={() => isAdmin}
                canDelete={() => isAdmin}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedData.length / pageSize)} totalItems={sortedData.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedData.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'エリア 編集' : 'エリア 新規登録'}>
                <AreaForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) await updateArea({ ...data, id: editingItem.id } as Area);
                    else await addArea(data as Omit<Area, 'id'>, true);
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!detailItem} onClose={() => setDetailItem(undefined)} title="エリア 詳細">
                {detailItem && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="text-sm text-gray-500">エリアコード</label><div>{detailItem.areaCode}</div></div>
                            <div><label className="text-sm text-gray-500">エリア名</label><div>{detailItem.areaName}</div></div>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
