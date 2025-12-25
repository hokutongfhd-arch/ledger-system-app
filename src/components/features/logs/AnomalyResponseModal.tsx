import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import type { Log, AnomalyResponseStatus } from '../../../lib/types';
import { useAuth } from '../../../features/context/AuthContext';

interface AnomalyResponseModalProps {
    log: Log;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (logId: string, status: AnomalyResponseStatus, note: string, adminUserId: string) => Promise<{ success: boolean; error?: string }>;
}

export const AnomalyResponseModal: React.FC<AnomalyResponseModalProps> = ({
    log,
    isOpen,
    onClose,
    onSubmit
}) => {
    const { user } = useAuth();
    const [status, setStatus] = useState<AnomalyResponseStatus>(log.response_status || 'pending');
    const [note, setNote] = useState(log.response_note || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const isNoteRequired = log.severity === 'high' || log.severity === 'critical' || status === 'completed';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (isNoteRequired && !note.trim()) {
            setError('重要度が「高」または「緊急」の場合は対応メモが必須です。');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            if (!user.authId) {
                setError('ログインユーザーの認証IDが見つかりません。再ログインを試してください。');
                return;
            }
            const result = await onSubmit(log.id, status, note, user.authId);
            if (result.success) {
                onClose();
            } else {
                setError(result.error || '保存に失敗しました');
            }
        } catch (err) {
            setError('予期せぬエラーが発生しました');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="text-amber-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-800">検知対応の登録</h2>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors font-bold">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-2">
                            <p className="text-xs text-red-800 font-bold mb-1">対象ログ概要:</p>
                            <p className="text-sm text-red-700">{log.details}</p>
                            <p className="text-[10px] text-red-500 mt-1 uppercase">重要度: {{
                                critical: '緊急',
                                high: '高',
                                medium: '中',
                                low: '低'
                            }[log.severity || 'low']}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">対応結果</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as AnomalyResponseStatus)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm"
                                required
                            >
                                <option value="pending">調査前</option>
                                <option value="investigating">調査中</option>
                                <option value="completed">完了</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                対応メモ {isNoteRequired && <span className="text-red-500 text-xs ml-1">*必須</span>}
                            </label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 transition-all text-sm min-h-[120px]"
                                placeholder="判断理由や実施した対応内容を記入してください"
                                required={isNoteRequired}
                            />
                        </div>

                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-blue-700 space-y-1">
                            <p>● 対応者: {user?.name || '管理者'}</p>
                            <p>● 登録日時: 現在の日時が自動的に記録されます</p>
                            <p>● 証跡保護: 「完了」として登録すると、ログの結果が「成功」になりアラートから除外されます</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:bg-blue-400"
                        >
                            {submitting ? (
                                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
                            ) : (
                                <Send size={18} />
                            )}
                            対応を登録する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
