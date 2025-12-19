'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Address } from '../../../features/addresses/address.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { AddressForm } from '../../../features/forms/AddressForm';
import { AddressDeviceList } from '../../../features/components/AddressDeviceList';
import * as XLSX from 'xlsx';

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
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Address | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Address | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);


    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const headers = ['No.', '住所コード', '事業所名', '事業部', 'エリアコード', 'TEL', 'FAX', '〒', '住所', '区分', '主担当', '枝番', '※', '宛名ラベル用', '宛名ラベル用〒', '宛名ラベル用住所', '備考', '注意書き'];

    const handleExportCSV = () => {
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => {
                const areaCode = areas.find(a => a.areaName === item.area)?.areaCode || '';
                return [
                    item.no || '',
                    item.addressCode || '',
                    item.officeName || '',
                    item.division || '',
                    areaCode,
                    item.tel || '',
                    item.fax || '',
                    item.zipCode || '',
                    item.address || '',
                    item.type || '',
                    item.mainPerson || '',
                    item.branchNumber || '',
                    item.specialNote || '',
                    item.labelName || '',
                    item.labelZip || '',
                    item.labelAddress || '',
                    item.notes || '',
                    item.attentionNote || ''
                ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            })
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `address_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '住所マスタエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
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

            const fileHeaders = jsonData[0] as string[];
            const missingHeaders = headers.filter(h => !fileHeaders.includes(h));
            if (missingHeaders.length > 0) {
                showNotification(`不足している項目があります: ${missingHeaders.join(', ')}`, 'alert', undefined, 'インポートエラー');
                return;
            }

            const rows = jsonData.slice(1);

            // Data bounds validation
            const validColumnCount = headers.length;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
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
                fileHeaders.forEach((header, index) => {
                    rowData[header] = row[index];
                });

                // Address Code Check (Simple validation)
                if (!rowData['住所コード']) {
                    errorCount++;
                    continue;
                }

                const areaCode = String(rowData['エリアコード'] || '');
                const matchedArea = areas.find(a => a.areaCode === areaCode);
                const areaName = matchedArea ? matchedArea.areaName : '';

                const newAddress: Omit<Address, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    officeName: String(rowData['事業所名'] || ''),
                    division: String(rowData['事業部'] || ''),
                    area: areaName,
                    tel: String(rowData['TEL'] || ''),
                    fax: String(rowData['FAX'] || ''),
                    zipCode: String(rowData['〒'] || ''),
                    address: String(rowData['住所'] || ''),
                    type: String(rowData['区分'] || ''),
                    mainPerson: String(rowData['主担当'] || ''),
                    branchNumber: String(rowData['枝番'] || ''),
                    specialNote: String(rowData['※'] || ''),
                    labelName: String(rowData['宛名ラベル用'] || ''),
                    labelZip: String(rowData['宛名ラベル用〒'] || ''),
                    labelAddress: String(rowData['宛名ラベル用住所'] || ''),
                    notes: String(rowData['備考'] || ''),
                    attentionNote: String(rowData['注意書き'] || '')
                };

                try {
                    await addAddress(newAddress, true);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('addresses', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
            }

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

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
                    <button onClick={handleExportCSV} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
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
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
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
