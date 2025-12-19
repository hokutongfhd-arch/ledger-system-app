'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Router } from '../../../features/devices/device.types';
import { Plus, Search, ArrowUp, ArrowDown, ArrowUpDown, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { NotificationModal } from '../../../components/ui/NotificationModal';
import { RouterForm } from '../../../features/forms/RouterForm';
import { Layout } from '../../../components/layout/Layout';
import * as XLSX from 'xlsx';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';

type SortKey = 'terminalCode' | 'carrier' | 'simNumber' | 'actualLenderName' | 'userName' | 'contractYears';
type SortOrder = 'asc' | 'desc';
interface SortCriterion {
    key: SortKey;
    order: SortOrder;
}

export default function RouterListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <Layout>
            <RouterListContent />
        </Layout>
    );
}

function RouterListContent() {
    const { routers, addRouter, updateRouter, deleteRouter, addLog, employees, addresses } = useData();
    const searchParams = useSearchParams();
    const highlightId = searchParams.get('highlight');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Router | undefined>(undefined);
    const [detailItem, setDetailItem] = useState<Router | undefined>(undefined);
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
    const handleEdit = (item: Router) => { setEditingItem(item); setIsModalOpen(true); };

    const handleDelete = async (item: Router) => {
        showNotification('本当に削除しますか？', 'confirm', async () => {
            try {
                await deleteRouter(item.id, true);
                await addLog('routers', 'delete', `ルーター削除: ${item.terminalCode}`);
            } catch (error) {
                showNotification('削除に失敗しました。', 'alert', undefined, 'エラー');
            }
        });
    };

    const filteredData = routers.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedData = [...filteredData].sort((a, b) => {
        for (const criterion of sortCriteria) {
            const { key, order } = criterion;
            let valA: any = key === 'userName' ? (employees.find(e => e.code === a.employeeCode)?.name || '') : a[key as keyof Router];
            let valB: any = key === 'userName' ? (employees.find(e => e.code === b.employeeCode)?.name || '') : b[key as keyof Router];

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

    const handleExportCSV = () => {
        const headers = [
            'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
            '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
            '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
            '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
        ];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(item => [
                item.no || '',
                item.contractStatus || '',
                item.contractYears || '',
                item.carrier || '',
                item.modelNumber || '',
                item.simNumber || '',
                item.dataCapacity || '',
                item.terminalCode,
                item.employeeCode || '',
                item.addressCode || '',
                item.actualLender || '',
                item.actualLenderName || '',
                item.company || '',
                item.ipAddress || '',
                item.subnetMask || '',
                item.startIp || '',
                item.endIp || '',
                item.biller || '',
                item.cost || '',
                item.costTransfer || '',
                item.costBearer || '',
                `"${item.lendingHistory || ''}"`,
                `"${item.notes || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `router_list_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
            '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
            '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
            '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'モバイルルーターエクセルフォーマット.xlsx');
    };

    const handleImportClick = () => {
        document.getElementById('fileInput')?.click();
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
                'No.', '契約状況', '契約年数', '通信キャリア', '機種型番', 'SIM電番',
                '通信容量', '端末CD', '社員コード', '住所コード', '実貸与先',
                '実貸与先名', '会社', 'IPアドレス', 'サブネットマスク', '開始IP',
                '終了IP', '請求元', '費用', '費用振替', '負担先', '貸与履歴', '備考(返却日)'
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

                const newRouter: Omit<Router, 'id'> = {
                    no: String(rowData['No.'] || ''),
                    contractStatus: String(rowData['契約状況'] || ''),
                    contractYears: normalizeContractYear(String(rowData['契約年数'] || '')),
                    carrier: String(rowData['通信キャリア'] || ''),
                    modelNumber: String(rowData['機種型番'] || ''),
                    simNumber: String(rowData['SIM電番'] || ''),
                    dataCapacity: String(rowData['通信容量'] || ''),
                    terminalCode: String(rowData['端末CD'] || ''),
                    employeeCode: String(rowData['社員コード'] || ''),
                    addressCode: String(rowData['住所コード'] || ''),
                    actualLender: String(rowData['実貸与先'] || ''),
                    actualLenderName: String(rowData['実貸与先名'] || ''),
                    company: String(rowData['会社'] || ''),
                    ipAddress: String(rowData['IPアドレス'] || ''),
                    subnetMask: String(rowData['サブネットマスク'] || ''),
                    startIp: String(rowData['開始IP'] || ''),
                    endIp: String(rowData['終了IP'] || ''),
                    biller: String(rowData['請求元'] || ''),
                    cost: parseInt(String(rowData['費用'] || '').replace(/[^0-9]/g, '')) || 0,
                    costTransfer: String(rowData['費用振替'] || ''),
                    costBearer: String(rowData['負担先'] || ''),
                    lendingHistory: String(rowData['貸与履歴'] || ''),
                    notes: String(rowData['備考(返却日)'] || ''),
                    returnDate: '',
                };

                try {
                    await addRouter(newRouter, true);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
            }

            if (successCount > 0) {
                await addLog('routers', 'import', `Excelインポート: ${successCount}件追加 (${errorCount}件失敗)`);
            }

            showNotification(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件`);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-text-main">ルーター管理台帳</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Download size={18} />CSV出力</button>
                    <button onClick={handleDownloadTemplate} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><FileSpreadsheet size={18} />フォーマットDL</button>
                    <button onClick={handleImportClick} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"><Upload size={18} />インポート</button>
                    <input type="file" id="fileInput" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"><Plus size={18} />新規登録</button>
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                </div>
            </div>

            <Table<Router>
                data={paginatedData}
                rowClassName={(item) => item.id === highlightId ? 'bg-red-100 hover:bg-red-200' : ''}
                columns={[
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('terminalCode')}>端末CD{getSortIcon('terminalCode')}</div>, accessor: (item) => <button onClick={() => setDetailItem(item)} className="text-blue-600 hover:underline">{item.terminalCode}</button> },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('carrier')}>通信キャリア{getSortIcon('carrier')}</div>, accessor: 'carrier' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('simNumber')}>SIM電番{getSortIcon('simNumber')}</div>, accessor: 'simNumber' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('actualLenderName')}>実貸与先名{getSortIcon('actualLenderName')}</div>, accessor: 'actualLenderName' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('userName')}>使用者名{getSortIcon('userName')}</div>, accessor: (item) => employees.find(e => e.code === item.employeeCode)?.name || '' },
                    { header: <div className="flex items-center cursor-pointer" onClick={() => toggleSort('contractYears')}>契約年数{getSortIcon('contractYears')}</div>, accessor: 'contractYears' },
                ]}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedData.length / pageSize)} totalItems={sortedData.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedData.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'ルーター 編集' : 'ルーター 新規登録'}>
                <RouterForm initialData={editingItem} onSubmit={async (data) => {
                    if (editingItem) await updateRouter({ ...data, id: editingItem.id } as Router, true);
                    else await addRouter(data as Omit<Router, 'id'>, true);
                    setIsModalOpen(false);
                }} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!detailItem} onClose={() => setDetailItem(undefined)} title="ルーター 詳細">
                {detailItem && (
                    <div className="space-y-8">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">No.</label><div className="text-gray-900">{detailItem.no || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">契約状況</label><div className="text-gray-900">{detailItem.contractStatus || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">契約年数</label><div className="text-gray-900">{detailItem.contractYears || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">通信キャリア</label><div className="text-gray-900">{detailItem.carrier || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">機種型番</label><div className="text-gray-900">{detailItem.modelNumber || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">SIM電番</label><div className="text-gray-900">{detailItem.simNumber || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">通信容量</label><div className="text-gray-900">{detailItem.dataCapacity || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">端末CD</label><div className="text-gray-900">{detailItem.terminalCode}</div></div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">社員名(社員コード)</label>
                                    <div className="text-gray-900">
                                        {employees.find(e => e.code === detailItem.employeeCode)?.name || '-'}
                                        {detailItem.employeeCode && ` (${detailItem.employeeCode})`}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">住所(住所コード)</label>
                                    <div className="text-gray-900">
                                        {addresses.find(a => a.addressCode === detailItem.addressCode)?.officeName || '-'}
                                        {detailItem.addressCode && ` (${detailItem.addressCode})`}
                                    </div>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">実貸与先</label><div className="text-gray-900">{detailItem.actualLender || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">実貸与先名</label><div className="text-gray-900">{detailItem.actualLenderName || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">会社</label><div className="text-gray-900">{detailItem.company || '-'}</div></div>
                            </div>
                        </div>

                        {/* Network Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">ネットワーク情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">IPアドレス</label><div className="text-gray-900">{detailItem.ipAddress || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">サブネットマスク</label><div className="text-gray-900">{detailItem.subnetMask || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">開始IP</label><div className="text-gray-900">{detailItem.startIp || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">終了IP</label><div className="text-gray-900">{detailItem.endIp || '-'}</div></div>
                            </div>
                        </div>

                        {/* Cost Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">費用・管理情報</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">請求元</label><div className="text-gray-900">{detailItem.biller || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">費用</label><div className="text-gray-900">{detailItem.cost ? `¥${detailItem.cost.toLocaleString()}` : '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">費用振替</label><div className="text-gray-900">{detailItem.costTransfer || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">負担先</label><div className="text-gray-900">{detailItem.costBearer || '-'}</div></div>
                            </div>
                        </div>

                        {/* Others */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">貸与履歴</label><div className="text-gray-900 whitespace-pre-wrap">{detailItem.lendingHistory || '-'}</div></div>
                                <div><label className="block text-sm font-medium text-gray-500 mb-1">備考(返却日)</label><div className="text-gray-900 whitespace-pre-wrap">{detailItem.notes || '-'}</div></div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal isOpen={notification.isOpen} onClose={closeNotification} title={notification.title} message={notification.message} type={notification.type} onConfirm={notification.onConfirm} />
        </div>
    );
}
