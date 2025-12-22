'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Log } from '../../../lib/types';
import { Download, ArrowUp, ArrowDown, ArrowUpDown, FileText, Activity } from 'lucide-react';
import { useAuditLogs } from '../../../features/logs/useAuditLogs';
import { LogFilter } from '../../../components/features/logs/LogFilter';
import { LogDetailModal } from '../../../components/features/logs/LogDetailModal';

export default function LogListPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <LogListContent />
    );
}

function LogListContent() {
    const {
        logs,
        loading,
        totalCount,
        currentPage,
        pageSize,
        filters,
        sort,
        setPageSize,
        setCurrentPage,
        updateFilter,
        handleSort,
        refresh,
        fetchAllForExport
    } = useAuditLogs();

    const [selectedLog, setSelectedLog] = useState<Log | null>(null);

    const getSortIcon = (field: 'occurred_at' | 'actor_name') => {
        if (sort.field !== field) return <ArrowUpDown size={14} className="ml-1 text-gray-300" />;
        return sort.order === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-blue-600" />
            : <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const handleExportCSV = async () => {
        const data = await fetchAllForExport();
        if (!data || data.length === 0) {
            alert('出力するデータがありません');
            return;
        }

        // CSV Header
        const headers = ['ID', '日時', '実行者名', '社員コード', '対象', 'アクション', '結果', '詳細', 'IPアドレス', 'Metadata'];

        // CSV Body
        const rows = data.map(log => [
            log.id,
            log.timestamp,
            log.actorName,
            log.actorEmployeeCode,
            log.target,
            log.action,
            log.result,
            log.details.replace(/"/g, '""'), // Escape quotes
            log.ipAddress,
            JSON.stringify(log.metadata).replace(/"/g, '""')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // BOM for Excel compatibility
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_logs_${filters.startDate.split('T')[0]}_${filters.endDate.split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Activity className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-main">監査ログ</h1>
                        <p className="text-xs text-text-muted">システム操作の履歴を検索・確認できます</p>
                    </div>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                >
                    <Download size={18} />
                    <span className="font-medium">CSVエクスポート</span>
                </button>
            </div>

            <LogFilter filters={filters} onUpdate={updateFilter} />

            <div className={`relative ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}

                <Table<Log>
                    data={logs}
                    columns={[
                        {
                            header: <div className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => handleSort('occurred_at')}>日時{getSortIcon('occurred_at')}</div>,
                            accessor: (item) => <div className="font-mono text-sm">{new Date(item.timestamp).toLocaleString('ja-JP')}</div>
                        },
                        {
                            header: <div className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => handleSort('actor_name')}>実行者{getSortIcon('actor_name')}</div>,
                            accessor: (item) => (
                                <div>
                                    <div className="font-medium text-gray-900">{item.actorName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{item.actorEmployeeCode}</div>
                                </div>
                            )
                        },
                        { header: '対象', accessor: 'target' },
                        {
                            header: '結果',
                            accessor: (item) => (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.result === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {item.result === 'success' ? '成功' : '失敗'}
                                </span>
                            )
                        },
                        {
                            header: '詳細',
                            accessor: (item) => (
                                <div className="max-w-xs truncate text-sm text-gray-600" title={item.details}>
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.actionRaw === 'DELETE' ? 'bg-red-400' :
                                            item.actionRaw === 'CREATE' ? 'bg-green-400' :
                                                item.actionRaw === 'UPDATE' ? 'bg-blue-400' : 'bg-gray-400'
                                        }`}></span>
                                    {item.details}
                                </div>
                            )
                        },
                        {
                            header: 'Action',
                            accessor: (item) => (
                                <button
                                    onClick={() => setSelectedLog(item)}
                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                                    title="詳細を確認"
                                >
                                    <FileText size={18} />
                                </button>
                            )
                        }
                    ]}
                />
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / pageSize)}
                totalItems={totalCount}
                startIndex={(currentPage - 1) * pageSize}
                endIndex={Math.min(currentPage * pageSize, totalCount)}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />

            <LogDetailModal
                log={selectedLog}
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
            />
        </div>
    );
}
