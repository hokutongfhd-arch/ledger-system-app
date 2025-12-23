import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';
import type { LogFilterState } from '../../../features/logs/useAuditLogs';

interface LogFilterProps {
    filters: LogFilterState;
    onUpdate: (key: keyof LogFilterState, value: string) => void;
}

export const LogFilter: React.FC<LogFilterProps> = ({ filters, onUpdate }) => {
    // Helper: Convert UTC ISO string to Local YYYY-MM-DDTHH:mm string for input
    const toLocalISOString = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    // Helper: Handle input change, convert Local back to UTC ISO
    const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
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
                        <Calendar size={12} /> 期間 (From - To)
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="datetime-local"
                            value={filters.startDate ? toLocalISOString(filters.startDate) : ''}
                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                        <span className="text-text-muted">-</span>
                        <input
                            type="datetime-local"
                            value={filters.endDate ? toLocalISOString(filters.endDate) : ''}
                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle focus:ring-2 focus:ring-blue-100 outline-none"
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

                {/* Result & Action */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium flex items-center gap-1">
                            <Filter size={12} /> 結果
                        </label>
                        <select
                            value={filters.result}
                            onChange={(e) => onUpdate('result', e.target.value)}
                            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle outline-none"
                        >
                            <option value="">すべて</option>
                            <option value="success">成功</option>
                            <option value="failure">失敗</option>
                        </select>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-xs text-text-muted font-medium">アクション</label>
                        <select
                            value={filters.actionType}
                            onChange={(e) => onUpdate('actionType', e.target.value)}
                            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle outline-none"
                        >
                            <option value="">すべて</option>
                            <option value="CREATE">登録</option>
                            <option value="UPDATE">更新</option>
                            <option value="DELETE">削除</option>
                            <option value="IMPORT">インポート</option>
                            <option value="LOGIN_SUCCESS">ログイン</option>
                            <option value="LOGIN_FAILURE">ログイン失敗</option>
                        </select>
                    </div>
                </div>

                {/* Target */}
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-text-muted font-medium">対象機能</label>
                    <select
                        value={filters.target}
                        onChange={(e) => onUpdate('target', e.target.value)}
                        className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background-subtle outline-none"
                    >
                        <option value="">すべて</option>
                        <option value="iphone">iPhone</option>
                        <option value="feature_phone">ガラホ</option>
                        <option value="tablet">勤怠タブレット</option>
                        <option value="router">モバイルルーター</option>
                        <option value="employee">社員マスタ</option>
                        <option value="area">エリアマスタ</option>
                        <option value="address">住所マスタ</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
