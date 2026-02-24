import React from 'react';
import { Search, Calendar, Filter, Database, Box } from 'lucide-react';
import type { OperationLogFilterState } from '../../../features/logs/useOperationLogs';

interface OperationLogFilterProps {
    filters: OperationLogFilterState;
    onUpdate: (key: keyof OperationLogFilterState, value: string) => void;
    readOnlyDates?: boolean;
    maxDate?: string;
}

const TABLE_OPTIONS = [
    { value: 'iphones', label: 'iPhone' },
    { value: 'featurephones', label: 'ガラホ' },
    { value: 'tablets', label: '勤怠タブレット' },
    { value: 'routers', label: 'モバイルルーター' },
    { value: 'employees', label: '社員マスタ' },
    { value: 'areas', label: 'エリアマスタ' },
    { value: 'addresses', label: '事業所マスタ' }
];

export const OperationLogFilter: React.FC<OperationLogFilterProps> = ({ filters, onUpdate, readOnlyDates, maxDate }) => {

    const toLocalISOString = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
        if (readOnlyDates) return;
        if (!value) {
            onUpdate(key, '');
            return;
        }
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            onUpdate(key, d.toISOString());
        }
    };

    return (
        <div className="bg-background-paper p-4 rounded-xl shadow-sm border border-border mb-4">
            <div className="grid grid-cols-12 gap-4">

                {/* Date Range */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                        <Calendar size={12} /> 期間 (From - To) {readOnlyDates && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded ml-1">今週固定</span>}
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="datetime-local"
                            value={filters.startDate ? toLocalISOString(filters.startDate) : ''}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            disabled={readOnlyDates}
                            max={maxDate ? toLocalISOString(maxDate) : undefined}
                            className={`w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none ${readOnlyDates ? 'cursor-not-allowed opacity-80' : ''}`}
                        />
                        <span className="text-text-muted">-</span>
                        <input
                            type="datetime-local"
                            value={filters.endDate ? toLocalISOString(filters.endDate) : ''}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            disabled={readOnlyDates}
                            max={maxDate ? toLocalISOString(maxDate) : undefined}
                            className={`w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none ${readOnlyDates ? 'cursor-not-allowed opacity-80' : ''}`}
                        />
                    </div>
                </div>

                {/* Actor Search */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                        <Search size={12} /> 実行者 (氏名 or 社員CD)
                    </label>
                    <input
                        type="text"
                        placeholder="検索..."
                        value={filters.actor}
                        onChange={(e) => onUpdate('actor', e.target.value)}
                        className="w-full text-sm border border-border rounded px-3 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                </div>

                {/* Table Name */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                        <Database size={12} /> 対象テーブル
                    </label>
                    <select
                        value={filters.tableName}
                        onChange={(e) => onUpdate('tableName', e.target.value)}
                        className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    >
                        <option value="">すべて</option>
                        {TABLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* Operation */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                        <Box size={12} /> 操作項目
                    </label>
                    <select
                        value={filters.operation}
                        onChange={(e) => onUpdate('operation', e.target.value)}
                        className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    >
                        <option value="">すべて</option>
                        <option value="INSERT">登録</option>
                        <option value="UPDATE">更新</option>
                        <option value="DELETE">削除</option>
                    </select>
                </div>

            </div>
        </div>
    );
};
