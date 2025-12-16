import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Table } from '../components/ui/Table';
import type { Log } from '../types';
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, Calendar } from 'lucide-react';
import { generateWeekRanges, getWeekRange } from '../utils/dateHelpers';

export const LogList = () => {
    const { logs, fetchLogRange, fetchLogMinDate } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Archive Logic
    const [isArchiveMode, setIsArchiveMode] = useState(false);
    const [weekOptions, setWeekOptions] = useState<{ start: Date; end: Date; label: string }[]>([]);
    const [selectedWeekLabel, setSelectedWeekLabel] = useState<string>('');

    useEffect(() => {
        // Fetch fresh logs on mount
        const { start, end } = getWeekRange(new Date());
        fetchLogRange(start.toISOString(), end.toISOString());

        const initWeeks = async () => {
            const minDateStr = await fetchLogMinDate();
            if (minDateStr) {
                const minDate = new Date(minDateStr);
                // Calculate end of last week to exclude current week
                const { start: currentWeekStart } = getWeekRange(new Date());
                const endOfLastWeek = new Date(currentWeekStart);
                endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);

                const ranges = generateWeekRanges(minDate, endOfLastWeek);
                setWeekOptions(ranges);
            }
        };
        initWeeks();
    }, [fetchLogRange, fetchLogMinDate]);

    const handleArchiveToggle = async () => {
        const newMode = !isArchiveMode;
        setIsArchiveMode(newMode);

        if (newMode) {
            // Switch to Archive: Select the most recent past week (index 1 if exists, else index 0)
            // Actually index 0 is "current week" in our generator usually if we include today.
            // Let's check generator... `generateWeekRanges` goes up to `toDate` (default today).
            // So index 0 is this week.
            if (weekOptions.length > 0) {
                // Select the first option by default
                const defaultWeek = weekOptions[0];
                setSelectedWeekLabel(defaultWeek.label);
                await fetchLogRange(defaultWeek.start.toISOString(), defaultWeek.end.toISOString());
            }
        } else {
            // Switch back to Current: fetch current week
            const { start, end } = getWeekRange(new Date());
            await fetchLogRange(start.toISOString(), end.toISOString());
        }
    };

    const handleWeekSelect = async (label: string) => {
        setSelectedWeekLabel(label);
        const range = weekOptions.find(w => w.label === label);
        if (range) {
            await fetchLogRange(range.start.toISOString(), range.end.toISOString());
        }
    };

    const filteredLogs = logs.filter(log =>
        Object.values(log).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const totalItems = filteredLogs.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Reset to page 1 if filter changes
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }

    const handlePageChange = (page: number) => {
        const p = Math.max(1, Math.min(page, totalPages));
        setCurrentPage(p);
    };

    const handleExportCSV = () => {
        const headers = ['日時', 'ユーザー', '対象', '操作', '詳細'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString('ja-JP'),
                log.user,
                log.target,
                log.action === 'add' ? '追加' : log.action === 'update' ? '更新' : log.action === 'delete' ? '削除' : 'インポート',
                `"${log.details}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `system_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isArchiveMode ? 'ログ (アーカイブ)' : 'ログ (今週)'}
                    </h1>
                </div>

                <button
                    onClick={handleArchiveToggle}
                    className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors text-sm shadow-sm border ${isArchiveMode
                        ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                >
                    <Archive size={16} />
                    {isArchiveMode ? '最新ログに戻る' : 'アーカイブ'}
                </button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="検索 (ユーザー, 対象, 詳細...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {isArchiveMode && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Calendar size={18} className="text-gray-500" />
                        <select
                            value={selectedWeekLabel}
                            onChange={(e) => handleWeekSelect(e.target.value)}
                            className="border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                        >
                            {weekOptions.map(option => (
                                <option key={option.label} value={option.label}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <Table<Log>
                containerClassName="max-h-[600px] overflow-y-auto border-b border-gray-200"
                data={paginatedLogs}
                columns={[
                    {
                        header: '日時',
                        accessor: (item) => new Date(item.timestamp).toLocaleString('ja-JP')
                    },
                    { header: 'ユーザー', accessor: 'user' },
                    { header: '対象', accessor: 'target' },
                    {
                        header: '操作',
                        accessor: (item) => (
                            <span className={`px-3 py-0.5 rounded text-xs font-bold ${item.action === 'add' ? 'bg-emerald-50 text-emerald-500' :
                                item.action === 'update' ? 'bg-blue-50 text-blue-500' :
                                    item.action === 'delete' ? 'bg-red-50 text-red-500' :
                                        'bg-purple-50 text-purple-500'
                                }`}>
                                {item.action === 'add' ? '追加' :
                                    item.action === 'update' ? '更新' :
                                        item.action === 'delete' ? '削除' : 'インポート'}
                            </span>
                        )
                    },
                    { header: '詳細', accessor: 'details' },
                ]}
            />

            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 border-t border-gray-200 mt-auto rounded-b-lg">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <span className="text-sm text-gray-600">
                        {totalItems} 件中 {startIndex + 1} - {endIndex} を表示
                    </span>
                    <button
                        onClick={handleExportCSV}
                        className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm shadow-sm"
                    >
                        <Download size={16} />
                        CSV出力
                    </button>
                </div>

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
                            <span className="text-sm text-gray-600">/ {totalPages} ページ</span>
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
        </div>
    );
};
