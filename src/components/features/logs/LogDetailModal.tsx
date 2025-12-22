import React from 'react';
import type { Log } from '../../../lib/types';
import { X, AlertTriangle, CheckCircle, Clock, User, HardDrive, Activity } from 'lucide-react';

interface LogDetailModalProps {
    log: Log | null;
    isOpen: boolean;
    onClose: () => void;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, isOpen, onClose }) => {
    if (!isOpen || !log) return null;

    const isFailure = log.result === 'failure';
    const metadataStr = JSON.stringify(log.metadata, null, 2);
    const isLargeMetadata = metadataStr.length > 2000;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className={`px-6 py-4 border-b flex justify-between items-center ${isFailure ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                        {isFailure ? (
                            <div className="p-2 bg-red-100 rounded-full text-red-600">
                                <AlertTriangle size={24} />
                            </div>
                        ) : (
                            <div className="p-2 bg-green-100 rounded-full text-green-600">
                                <CheckCircle size={24} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">ログ詳細</h2>
                            <p className="text-sm text-gray-500 font-mono">{log.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Key Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoItem icon={<Clock size={16} />} label="日時" value={new Date(log.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} />
                        <InfoItem icon={<User size={16} />} label="実行者" value={`${log.actorName} (${log.actorEmployeeCode})`} />
                        <InfoItem icon={<Activity size={16} />} label="アクション" value={log.action} />
                        <InfoItem icon={<HardDrive size={16} />} label="対象機能" value={`${log.target} (ID: ${log.targetId || '-'})`} />
                    </div>

                    {/* Details Text */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">概要</h3>
                        <p className="text-gray-900 leading-relaxed">{log.details}</p>
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
                            Metadata (Raw JSON)
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
    );
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
