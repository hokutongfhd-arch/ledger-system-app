import React, { useState } from 'react';
import type { Log, AnomalyResponseStatus } from '../../../lib/types';
import { X, AlertTriangle, CheckCircle, Clock, User, HardDrive, Activity, Shield, FileText, Check, Search, ListFilter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AnomalyResponseModal } from './AnomalyResponseModal';

interface LogDetailModalProps {
    log: Log | null;
    isOpen: boolean;
    onClose: () => void;
    onSubmitResponse: (logId: string, status: AnomalyResponseStatus, note: string, adminUserId: string) => Promise<{ success: boolean; error?: string }>;
    isDashboardContext?: boolean;
}

const STATUS_MAP: Record<string, string> = {
    pending: '未対応',
    investigating: '調査中',
    completed: '対応済'
};

const SEVERITY_LABELS: Record<string, string> = {
    critical: '重大',
    high: '高',
    medium: '中',
    low: '低'
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
        <div className="mt-0.5 text-gray-400">{icon}</div>
        <div>
            <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
            <p className="text-sm text-gray-900 font-medium break-all">{value}</p>
        </div>
    </div>
);

const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, isOpen, onClose, onSubmitResponse, isDashboardContext = false }) => {
    const router = useRouter();
    const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);

    // Reset sub-modal state when log changes
    React.useEffect(() => {
        setIsResponseModalOpen(false);
    }, [log?.id]);

    if (!isOpen || !log) return null;

    const isFailure = log.result === 'failure';
    const isAnomaly = log.actionRaw === 'ANOMALY_DETECTED';
    const metadataStr = JSON.stringify(log.metadata, null, 2);
    const isLargeMetadata = metadataStr.length > 2000;

    // Determine if this log needs a response or already has one
    const needsResponse = (isAnomaly ||
        isFailure ||
        (log.severity && log.severity !== 'low')) && log.actionRaw !== 'GENERATE';
    const hasResponse = !!log.response_status || log.is_acknowledged;
    const showResponseSection = needsResponse || hasResponse;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                    {/* Header */}
                    <div className={`px-6 py-4 border-b flex justify-between items-center ${isAnomaly ? 'bg-amber-50 border-amber-100' : isFailure ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                            {isAnomaly ? (
                                <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                                    <Shield size={24} />
                                </div>
                            ) : isFailure ? (
                                <div className="p-2 bg-red-100 rounded-full text-red-600">
                                    <AlertTriangle size={24} />
                                </div>
                            ) : (
                                <div className="p-2 bg-green-100 rounded-full text-green-600">
                                    <CheckCircle size={24} />
                                </div>
                            )}
                            <div>
                                <h2 className="text-lg font-bold text-[#0A0E27]">{isAnomaly ? '不正検知ログ詳細' : 'ログ詳細'}</h2>
                                <p className="text-xs text-gray-400 font-mono tracking-tighter">{log.id}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-6">

                        {showResponseSection && (
                            <div className={`p-4 rounded-xl border-2 ${log.is_acknowledged ? 'bg-green-50 border-green-200' :
                                log.response_status ? 'bg-amber-50 border-amber-200 shadow-sm' :
                                    isAnomaly ? 'bg-amber-50 border-amber-200 animate-pulse-subtle' :
                                        isFailure ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                                }`}>
                                <h3 className="text-sm font-bold flex items-center justify-between gap-2 mb-3 text-gray-800">
                                    <div className="flex items-center gap-2">
                                        <Shield size={18} className={log.is_acknowledged ? 'text-green-600' : isAnomaly ? 'text-amber-600' : 'text-blue-600'} />
                                        対応証跡管理
                                    </div>
                                    {log.response_status && !log.is_acknowledged && (
                                        <button
                                            onClick={() => setIsResponseModalOpen(true)}
                                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded font-bold transition-all active:scale-95"
                                        >
                                            対応を更新する
                                        </button>
                                    )}
                                </h3>
                                {log.response_status ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                <User size={14} /> 最終対応者ID
                                            </div>
                                            <div className="text-sm font-mono bg-white px-2 py-1.5 rounded border border-gray-200 truncate">
                                                {log.acknowledged_by}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                <Clock size={14} /> 最終更新日時
                                            </div>
                                            <div className="text-sm bg-white px-2 py-1.5 rounded border border-gray-200">
                                                {log.acknowledged_at ? new Date(log.acknowledged_at).toLocaleString('ja-JP') : '-'}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                <Check size={14} /> 現在のステータス
                                            </div>
                                            <div className={`text-xs font-bold px-3 py-1 rounded border w-fit ${log.is_acknowledged ? 'bg-gray-100 border-gray-200 text-gray-500' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                {STATUS_MAP[log.response_status || ''] || log.response_status}
                                                {log.is_acknowledged && <span className="ml-2 text-[10px] font-medium opacity-60">記録済</span>}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                <FileText size={14} /> 対応メモ
                                            </div>
                                            <div className="text-sm bg-white p-3 rounded-lg border border-gray-200 italic leading-relaxed text-gray-600">
                                                {log.response_note || '(メモなし)'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
                                        <div className="space-y-1">
                                            <p className={`text-sm font-bold flex items-center gap-2 ${isAnomaly ? 'text-amber-800' : isFailure ? 'text-red-800' : 'text-blue-800'}`}>
                                                対応が必要です
                                            </p>
                                            <p className="text-xs text-gray-600 leading-relaxed">
                                                {isAnomaly
                                                    ? '未対応の不正検知です。速やかに状況を確認し、対応内容を記録してください。'
                                                    : '未対応のイベントです。状況を確認し、必要に応じて対応内容を記録してください。'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsResponseModalOpen(true)}
                                            className={`${isAnomaly ? 'bg-[#0A0E27] hover:bg-[#1A1E37]' :
                                                isFailure ? 'bg-[#FF6B6B] hover:bg-[#FF8585]' : 'bg-[#00F0FF] hover:bg-[#33F3FF] text-[#0A0E27]'
                                                } text-white px-8 py-2.5 rounded shadow-sm font-bold transition-all flex items-center gap-2 shrink-0 active:scale-95 border-2 border-[#0A0E27]`}
                                        >
                                            対応を登録する
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Key Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InfoItem icon={<Clock size={16} />} label="日時" value={new Date(log.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} />

                            <div className="relative group">
                                <InfoItem icon={<User size={16} />} label="実行者" value={`${log.actorName} (${log.actorEmployeeCode})`} />
                                {isDashboardContext && (
                                    <button
                                        onClick={() => { onClose(); router.push(`/logs?actor=${log.actorEmployeeCode}&logId=${log.id}`); }}
                                        className="absolute top-2 right-2 p-1.5 bg-blue-50 text-blue-600 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-100"
                                        title="この実行者のログを確認"
                                    >
                                        <Search size={14} />
                                    </button>
                                )}
                            </div>

                            <InfoItem icon={<Activity size={16} />} label="アクション種別" value={log.action} />

                            <div className="relative group">
                                <InfoItem icon={<HardDrive size={16} />} label="対象種別" value={`${log.target} (ID: ${log.targetId || '-'})`} />
                                {log.targetId && isDashboardContext && (
                                    <button
                                        onClick={() => { onClose(); router.push(`/logs?target=${log.targetRaw}&logId=${log.id}`); }}
                                        className="absolute top-2 right-2 p-1.5 bg-blue-50 text-blue-600 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-100"
                                        title="この対象のログを確認"
                                    >
                                        <Search size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Details Text */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-2">概要</h3>
                                <p className="text-gray-900 leading-relaxed text-sm">{log.details}</p>
                                {log.severity && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">重要度:</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${log.severity === 'critical' ? 'bg-red-600 text-white' :
                                            log.severity === 'high' ? 'bg-red-100 text-red-600' :
                                                log.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                                                    'bg-blue-100 text-blue-600'
                                            }`}>
                                            {SEVERITY_LABELS[log.severity] || log.severity}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {isAnomaly && isDashboardContext && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        // Transition to main logs with actor name filtered to see context
                                        router.push(`/logs?actor=${log.actorEmployeeCode}&logId=${log.id}&actionType=ANOMALY_DETECTED`);
                                    }}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all active:scale-[0.98]"
                                >
                                    <ListFilter size={16} />
                                    監査ログ一覧で関連履歴を調査する
                                </button>
                            )}
                        </div>

                        {/* IP Address */}
                        {log.ipAddress && (
                            <div className="text-xs text-gray-400 text-right">
                                IP Address: {log.ipAddress}
                            </div>
                        )}

                        {/* Metadata JSON */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-2 flex justify-between items-center">
                                メタデータ (JSON原文)
                                <span className="text-xs font-normal text-gray-400">{new Blob([metadataStr]).size} bytes</span>
                            </h3>
                            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto border border-slate-700 relative group">
                                {isLargeMetadata && (
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">Large Data</span>
                                    </div>
                                )}
                                <pre className="text-xs text-blue-300 font-mono whitespace-pre-wrap break-all">
                                    {metadataStr}
                                </pre>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-gray-50 flex justify-end">
                        <button onClick={onClose} className="px-5 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-all shadow-sm">
                            閉じる
                        </button>
                    </div>
                </div>
            </div>

            {/* Anomaly Response Modal */}
            {isResponseModalOpen && (
                <AnomalyResponseModal
                    key={`${log.id}-${log.acknowledged_at || 'initial'}`}
                    log={log}
                    isOpen={isResponseModalOpen}
                    onClose={() => setIsResponseModalOpen(false)}
                    onSubmit={onSubmitResponse}
                />
            )}
        </>
    );
};

export default LogDetailModal;
