'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Log } from '../../../lib/types';
import { Download, ArrowUp, ArrowDown, ArrowUpDown, FileText, Activity, Database, History } from 'lucide-react';
import { useAuditLogs } from '../../../features/logs/useAuditLogs';
import { useOperationLogs } from '../../../features/logs/useOperationLogs';
import { getWeekRange } from '../../../lib/utils/dateHelpers';
import { LogFilter } from '../../../features/logs/components/LogFilter';
import { OperationLogFilter } from '../../../features/logs/components/OperationLogFilter';
import LogDetailModal from '../../../features/logs/components/LogDetailModal';
import { OperationLogDetailModal } from '../../../features/logs/components/OperationLogDetailModal';
import type { OperationLog } from '../../../lib/types';
import { logger } from '../../../lib/logger';
import { clsx } from 'clsx';


export default function LogListPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'audit' | 'operation'>('audit');

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Header & Global Controls */}
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Activity className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-main">システムログ管理</h1>
                        <p className="text-xs text-text-muted">監査ログおよび詳細な操作履歴を確認できます</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200",
                            activeTab === 'audit' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 font-medium"
                        )}
                    >
                        <Activity size={16} />
                        監査ログ
                    </button>
                    <button
                        onClick={() => setActiveTab('operation')}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200",
                            activeTab === 'operation' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 font-medium"
                        )}
                    >
                        <History size={16} />
                        操作ログ
                    </button>
                </div>
            </div>

            {activeTab === 'audit' ? <AuditLogContent /> : <OperationLogContent />}
        </div>
    );
}

function AuditLogContent() {
    const { user } = useAuth();
    const {
        logs,
        loading,
        totalCount,
        currentPage,
        pageSize,
        filters,
        sort,
        showArchived,
        setShowArchived,
        setPageSize,
        setCurrentPage,
        updateFilter,
        handleSort,
        fetchAllForExport,
        submitResponse,
        initialSelectedLog,
        setInitialSelectedLog
    } = useAuditLogs();

    const [selectedLog, setSelectedLog] = useState<Log | null>(null);

    // Initial log selection from URL or updates from list
    useEffect(() => {
        if (initialSelectedLog) {
            setSelectedLog(initialSelectedLog);
            setInitialSelectedLog(null); // Clear after consumption
        }
    }, [initialSelectedLog, setInitialSelectedLog]);

    useEffect(() => {
        if (selectedLog && logs) {
            const updated = logs.find(l => l.id === selectedLog.id);
            if (updated) {
                // Ensure deep equality check to prevent loops
                if (JSON.stringify(updated) !== JSON.stringify(selectedLog)) {
                    setSelectedLog(updated);
                }
            }
        }
    }, [logs, selectedLog]);

    const getSortIcon = (field: 'occurred_at' | 'actor_name' | 'is_acknowledged') => {
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

        // Log the export action
        await logger.log({
            action: 'EXPORT',
            targetType: 'report',
            targetId: 'audit_logs',
            result: 'success',
            message: `監査ログのエクスポート: ${data.length}件`
        });

        const headers = ['日時', '実行者', '対応', '結果', '詳細'];
        const rows = data.map(log => {
            // Logic to determine Response status (matching UI)
            const isLoginFailure = log.actionRaw === 'LOGIN_FAILURE';
            const isHighRiskLoginFailure = isLoginFailure && (log.severity === 'high' || log.severity === 'critical');

            const needsResponse = log.actionRaw === 'ANOMALY_DETECTED' ||
                (log.result === 'failure' && (!isLoginFailure || isHighRiskLoginFailure)) ||
                (isHighRiskLoginFailure);

            let responseStatus = '-';
            if (needsResponse || log.is_acknowledged) {
                responseStatus = log.is_acknowledged ? '対応済' : '未対応';
            }

            return [
                new Date(log.timestamp).toLocaleString('ja-JP'),
                `${log.actorName} (${log.actorEmployeeCode})`,
                responseStatus,
                log.result === 'success' ? '成功' : '失敗',
                log.details?.replace(/"/g, '""') || ''
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4 flex flex-col flex-1">
            <div className="flex justify-end items-center gap-3 mb-2">
                {user?.role === 'admin' && (
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">アーカイブを表示</span>
                    </label>
                )}
                <button
                    onClick={handleExportCSV}
                    className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all text-sm font-bold"
                >
                    <Download size={16} />
                    CSV出力
                </button>
            </div>

            <LogFilter
                filters={filters}
                onUpdate={updateFilter}
                readOnlyDates={!showArchived}
                maxDate={showArchived ? (new Date(new Date(getWeekRange(new Date()).start).getTime() - 1)).toISOString() : undefined}
            />

            <div className={`relative flex-1 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                        {
                            header: <div className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => handleSort('is_acknowledged')}>対応{getSortIcon('is_acknowledged')}</div>,
                            accessor: (item) => {
                                const isLoginFailure = item.actionRaw === 'LOGIN_FAILURE';
                                const isHighRiskLoginFailure = isLoginFailure && (item.severity === 'high' || item.severity === 'critical');

                                // Determine if this log needs a response badge
                                const needsResponse = item.actionRaw === 'ANOMALY_DETECTED' ||
                                    (item.result === 'failure' && (!isLoginFailure || isHighRiskLoginFailure)) || // Login failure only if high risk
                                    (item.severity && item.severity !== 'low' && item.severity !== 'medium' && !isLoginFailure) || // Other severities
                                    (isHighRiskLoginFailure);

                                if (!needsResponse && !item.is_acknowledged) return <span className="text-gray-400">-</span>;

                                return (
                                    <span className={clsx(
                                        "px-3 py-1 rounded text-[10px] font-bold tracking-wider whitespace-nowrap",
                                        item.is_acknowledged ? 'bg-gray-100 text-gray-400' :
                                            item.actionRaw === 'ANOMALY_DETECTED' ? 'bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20 animate-pulse-subtle' :
                                                item.result === 'failure' ? 'bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20' : 'bg-[#0EA5E9]/10 text-[#008A94] border border-[#0EA5E9]/20'
                                    )}>
                                        {item.is_acknowledged ? '対応済' : '未対応'}
                                    </span>
                                );
                            }
                        },
                        {
                            header: '結果',
                            accessor: (item) => (
                                <span className={clsx(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm",
                                    item.result === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                )}>
                                    {item.result === 'success' ? '成功' : '失敗'}
                                </span>
                            )
                        },
                        {
                            header: '詳細',
                            accessor: (item) => (
                                <div className="max-w-xs truncate text-sm text-gray-600" title={item.details}>
                                    <span className={clsx(
                                        "inline-block w-2 h-2 rounded-full mr-2",
                                        item.actionRaw === 'DELETE' ? 'bg-red-400' :
                                            item.actionRaw === 'CREATE' ? 'bg-green-400' :
                                                item.actionRaw === 'UPDATE' ? 'bg-blue-400' : 'bg-gray-400'
                                    )}></span>
                                    {item.details}
                                </div>
                            )
                        },
                        {
                            header: '詳細内容',
                            accessor: (item) => (
                                <button
                                    onClick={() => setSelectedLog(item)}
                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                                    title="ボタンをクリックして詳細を表示"
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
                key={selectedLog?.id}
                log={selectedLog}
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                onSubmitResponse={submitResponse}
                isDashboardContext={false}
            />
        </div>
    );
}

function OperationLogContent() {
    const { user } = useAuth();
    const {
        logs,
        loading,
        totalCount,
        currentPage,
        pageSize,
        filters,
        sort,
        showArchived,
        setShowArchived,
        setPageSize,
        setCurrentPage,
        updateFilter,
        handleSort,
        fetchAllForExport
    } = useOperationLogs();

    const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

    const TABLE_LABELS: Record<string, string> = {
        employees: '社員マスタ',
        areas: 'エリアマスタ',
        addresses: '住所マスタ',
        tablets: '勤怠タブレット',
        iphones: 'iPhone',
        featurephones: 'ガラホ',
        routers: 'モバイルルーター',
        audit_reports: '監査レポート履歴'
    };

    const getSortIcon = (field: 'created_at' | 'actor_name') => {
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

        // Log the export action
        await logger.log({
            action: 'EXPORT',
            targetType: 'report',
            targetId: 'operation_logs',
            result: 'success',
            message: `操作ログのエクスポート: ${data.length}件`
        });

        const headers = ['日時', '実行者名', '社員CD', 'テーブル', '操作', '変更前データ', '変更後データ'];
        const rows = data.map(log => [
            // log.id, // Removed ID
            log.timestamp,
            log.actorName,
            log.actorCode,
            TABLE_LABELS[log.tableName] || log.tableName,
            log.operation,
            JSON.stringify(log.oldData).replace(/"/g, '""'),
            JSON.stringify(log.newData).replace(/"/g, '""')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `operation_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4 flex flex-col flex-1">
            <div className="flex justify-end items-center gap-3 mb-2">
                {user?.role === 'admin' && (
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm text-sm">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                        />
                        <span className="font-medium text-gray-700">アーカイブを表示</span>
                    </label>
                )}
                <button
                    onClick={handleExportCSV}
                    className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-1.5 rounded-lg flex items-center gap-2 shadow-sm transition-all text-sm font-bold"
                >
                    <Download size={16} />
                    CSV出力
                </button>
            </div>

            <OperationLogFilter
                filters={filters}
                onUpdate={updateFilter}
                readOnlyDates={!showArchived}
                maxDate={showArchived ? (new Date(new Date(getWeekRange(new Date()).start).getTime() - 1)).toISOString() : undefined}
            />

            <div className={`relative flex-1 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}

                <Table<OperationLog>
                    data={logs}
                    columns={[
                        {
                            header: <div className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => handleSort('created_at')}>発生日時{getSortIcon('created_at')}</div>,
                            accessor: (item) => <div className="font-mono text-sm">{new Date(item.timestamp).toLocaleString('ja-JP')}</div>
                        },
                        {
                            header: <div className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={() => handleSort('actor_name')}>実行者{getSortIcon('actor_name')}</div>,
                            accessor: (item) => (
                                <div>
                                    <div className="font-medium text-gray-900">{item.actorName}</div>
                                    <div className="text-xs text-gray-500 font-mono">{item.actorCode}</div>
                                </div>
                            )
                        },
                        {
                            header: '対象テーブル',
                            accessor: (item) => <span className="font-medium text-gray-700">{TABLE_LABELS[item.tableName] || item.tableName}</span>
                        },
                        {
                            header: '操作',
                            accessor: (item) => (
                                <span className={clsx(
                                    "px-2 py-0.5 rounded text-xs font-bold",
                                    item.operation === 'INSERT' ? 'bg-green-100 text-green-700' :
                                        item.operation === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                )}>
                                    {item.operation === 'INSERT' ? '登録' :
                                        item.operation === 'DELETE' ? '削除' : '更新'}
                                </span>
                            )
                        },
                        {
                            header: '変更内容',
                            accessor: (item) => (
                                <button
                                    onClick={() => setSelectedLog(item)}
                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                                    title="変更履歴を詳しく見る"
                                >
                                    <Database size={18} />
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

            <OperationLogDetailModal
                log={selectedLog}
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
            />
        </div>
    );
}
