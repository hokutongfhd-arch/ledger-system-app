import React from 'react';
import type { OperationLog } from '../../../lib/types';
import { X, Clock, User, Database, Activity, ArrowRight, MinusCircle, PlusCircle, RefreshCw } from 'lucide-react';

interface OperationLogDetailModalProps {
    log: OperationLog | null;
    isOpen: boolean;
    onClose: () => void;
}

const TABLE_LABELS: Record<string, string> = {
    employees: '社員マスタ',
    areas: 'エリアマスタ',
    addresses: '住所マスタ',
    tablets: '勤怠タブレット',
    iphones: 'iPhone',
    featurephones: 'ガラホ',
    routers: 'モバイルルーター'
};

const OP_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    INSERT: { label: '登録', color: 'text-green-600 bg-green-50', icon: <PlusCircle size={16} /> },
    UPDATE: { label: '更新', color: 'text-blue-600 bg-blue-50', icon: <RefreshCw size={16} /> },
    DELETE: { label: '削除', color: 'text-red-600 bg-red-50', icon: <MinusCircle size={16} /> },
};

export const OperationLogDetailModal: React.FC<OperationLogDetailModalProps> = ({ log, isOpen, onClose }) => {
    if (!isOpen || !log) return null;

    const opInfo = OP_MAP[log.operation] || { label: log.operation, color: 'text-gray-600 bg-gray-50', icon: null };

    const renderDiff = () => {
        const oldData = log.oldData || {};
        const newData = log.newData || {};

        // Ignore internal DB fields in diff if possible, or show all
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
            .filter(k => !['id', 'created_at', 'updated_at', 'auth_id'].includes(k))
            .sort();

        const changes = allKeys.filter(key => {
            const oldVal = oldData[key];
            const newVal = newData[key];
            // Shallow compare for JSONB primitives
            return JSON.stringify(oldVal) !== JSON.stringify(newVal);
        });

        if (changes.length === 0) {
            return <div className="text-center py-8 text-text-muted italic">変更箇所はありません</div>;
        }

        return (
            <div className="border rounded-lg overflow-hidden border-border bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-border">
                        <tr>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/4">項目名</th>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/3">変更前</th>
                            <th className="px-4 py-2 w-8"></th>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/3">変更後</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {changes.map(key => (
                            <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2 font-mono text-xs text-blue-600 font-medium">
                                    {key}
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-red-600 bg-red-50 px-2 py-1 rounded line-through break-all whitespace-pre-wrap">
                                        {log.oldData?.[key] !== undefined ? String(log.oldData[key]) : <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center text-gray-400">
                                    <ArrowRight size={14} />
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-green-700 bg-green-50 px-2 py-1 rounded font-medium break-all whitespace-pre-wrap">
                                        {log.newData?.[key] !== undefined ? String(log.newData[key]) : <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${opInfo.color}`}>
                            {opInfo.icon}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">操作ログ詳細</h2>
                            <p className="text-xs text-gray-500 font-mono italic">ID: {log.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors group">
                        <X size={20} className="text-gray-500 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-background">

                    {/* Meta Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <InfoItem icon={<Clock size={16} />} label="日時" value={new Date(log.timestamp).toLocaleString('ja-JP')} />
                        <InfoItem icon={<User size={16} />} label="実行者" value={`${log.actorName} (${log.actorCode})`} />
                        <InfoItem icon={<Activity size={16} />} label="操作" value={opInfo.label} />
                        <InfoItem icon={<Database size={16} />} label="対象テーブル" value={TABLE_LABELS[log.tableName] || log.tableName} />
                    </div>

                    {/* Diff View */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                            データ変更履歴
                        </h3>
                        {renderDiff()}
                    </div>

                    {/* Raw Metadata (Optional/Hidden in detailed view usually, but we have newData/oldData) */}
                    {/* Collapsible/Hidden Raw Section could go here if needed */}

                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-bold transition-all shadow-sm active:scale-95">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="p-3 bg-white rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            {icon} {label}
        </div>
        <div className="text-sm font-bold text-gray-900 truncate" title={value}>
            {value}
        </div>
    </div>
);
