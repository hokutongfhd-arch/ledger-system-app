'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import type { Log } from '../../../features/logs/log.types';
import { Search, Download, Archive, Calendar, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { generateWeekRanges, getWeekRange } from '../../../lib/utils/dateHelpers';


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
    const { logs, fetchLogRange, fetchLogMinDate } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'default'>('default');
    const [isArchiveMode, setIsArchiveMode] = useState(false);
    const [weekOptions, setWeekOptions] = useState<{ start: Date; end: Date; label: string }[]>([]);
    const [selectedWeekLabel, setSelectedWeekLabel] = useState<string>('');

    useEffect(() => {
        const { start, end } = getWeekRange(new Date());
        fetchLogRange(start.toISOString(), end.toISOString());
        const initWeeks = async () => {
            const minDateStr = await fetchLogMinDate();
            if (minDateStr) {
                const { start: currentWeekStart } = getWeekRange(new Date());
                const endOfLastWeek = new Date(currentWeekStart);
                endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
                setWeekOptions(generateWeekRanges(new Date(minDateStr), endOfLastWeek));
            }
        };
        initWeeks();
    }, [fetchLogRange, fetchLogMinDate]);

    const handleArchiveToggle = async () => {
        const newMode = !isArchiveMode;
        setIsArchiveMode(newMode);
        setCurrentPage(1); // Reset to page 1
        if (newMode && weekOptions.length > 0) {
            setSelectedWeekLabel(weekOptions[0].label);
            await fetchLogRange(weekOptions[0].start.toISOString(), weekOptions[0].end.toISOString());
        } else {
            const { start, end } = getWeekRange(new Date());
            await fetchLogRange(start.toISOString(), end.toISOString());
        }
    };

    const handleWeekSelect = async (label: string) => {
        setSelectedWeekLabel(label);
        setCurrentPage(1); // Reset to page 1
        const range = weekOptions.find(w => w.label === label);
        if (range) await fetchLogRange(range.start.toISOString(), range.end.toISOString());
    };

    const sortedLogs = [...logs]
        .filter(log => Object.values(log).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())))
        .sort((a, b) => {
            if (sortOrder === 'default') return 0;
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        });

    const paginatedLogs = sortedLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const toggleSort = () => setSortOrder(prev => (prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default'));

    const getSortIcon = () => {
        if (sortOrder === 'asc') return <ArrowUp size={14} className="ml-1 text-blue-600" />;
        if (sortOrder === 'desc') return <ArrowDown size={14} className="ml-1 text-blue-600" />;
        return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-text-main">{isArchiveMode ? 'ログ (アーカイブ)' : 'ログ (今週)'}</h1>
                <div className="flex gap-2">
                    <button onClick={handleArchiveToggle} className={`px-4 py-2 rounded-lg flex items-center gap-2 border ${isArchiveMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-background-paper text-text-secondary border-border'}`}>
                        <Archive size={18} />{isArchiveMode ? '最新ログに戻る' : 'アーカイブ'}
                    </button>
                    <button onClick={() => { }} className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle"><Download size={18} />CSV出力</button>
                </div>
            </div>

            <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                    <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main" />
                </div>
                {isArchiveMode && (
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-text-muted" />
                        <select value={selectedWeekLabel} onChange={(e) => handleWeekSelect(e.target.value)} className="border border-border rounded-lg px-4 py-2 outline-none bg-background-subtle text-text-main">
                            {weekOptions.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <Table<Log>
                data={paginatedLogs}
                columns={[
                    { header: <div className="flex items-center cursor-pointer" onClick={toggleSort}>日時{getSortIcon()}</div>, accessor: (item) => new Date(item.timestamp).toLocaleString('ja-JP') },
                    { header: 'ユーザー', accessor: 'user' },
                    { header: '対象', accessor: (item) => (item.target.toLowerCase() === 'iphone' || item.target.toLowerCase() === 'iphones') ? 'iPhone' : item.target },
                    {
                        header: '操作', accessor: (item) => {
                            let label = '更新';
                            let className = 'bg-blue-50 text-blue-500';

                            if (item.action === 'add' || item.action === 'import') {
                                label = '追加';
                                className = 'bg-emerald-50 text-emerald-500';
                            } else if (item.action === 'delete') {
                                label = '削除';
                                className = 'bg-red-50 text-red-500';
                            }

                            return (
                                <span className={`px-2 py-1 rounded text-xs font-bold ${className}`}>
                                    {label}
                                </span>
                            );
                        }
                    },
                    { header: '詳細', accessor: 'details' },
                ]}
            />

            <Pagination currentPage={currentPage} totalPages={Math.ceil(sortedLogs.length / pageSize)} totalItems={sortedLogs.length} startIndex={(currentPage - 1) * pageSize} endIndex={Math.min(currentPage * pageSize, sortedLogs.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
        </div>
    );
}
