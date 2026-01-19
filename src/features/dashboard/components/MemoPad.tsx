import React, { useState } from 'react';
import { Trash2, Check, FileText } from 'lucide-react';
import { useMemos } from '../hooks/useMemos';
import { useConfirm } from '../../../hooks/useConfirm';
import { NotificationModal } from '../../../components/ui/NotificationModal';

interface MemoPadProps {
    employeeCode: string; // Changed from userId to employeeCode
}

export const MemoPad: React.FC<MemoPadProps> = ({ employeeCode }) => {
    const { memos, addMemo, deleteMemo } = useMemos(employeeCode);
    const [inputText, setInputText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    // Notification State
    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
    }>({
        isOpen: false,
        title: '通知',
        message: '',
    });

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, isOpen: false }));
    };

    const showNotification = (message: string, title: string = '通知') => {
        setNotification({
            isOpen: true,
            title,
            message,
        });
    };

    const handleSave = async () => {
        if (!inputText.trim()) return;
        setIsSubmitting(true);
        const success = await addMemo(inputText);
        if (success) {
            showNotification('保存しました');
            setInputText('');
        }
        setIsSubmitting(false);
    };

    const handleClear = () => {
        setInputText('');
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: '確認',
            description: 'このメモを削除しますか？',
            confirmText: 'Delete',
            variant: 'destructive',
        });

        if (confirmed) {
            await deleteMemo(id);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Input Area */}
            <div className="card bg-background-paper border border-border shadow-card rounded-2xl p-0 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border bg-background-subtle flex justify-between items-center">
                    <h3 className="font-bold text-text-main flex items-center gap-2">
                        <FileText size={20} className="text-secondary-ocean" />
                        新規メモ作成
                    </h3>
                </div>
                <div className="p-4 flex flex-col gap-4">
                    <textarea
                        className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-background-primary text-text-main focus:ring-2 focus:ring-accent-electric focus:border-transparent outline-none resize-none"
                        placeholder="メモを入力してください..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={handleClear}
                            disabled={!inputText}
                            className="p-2 rounded-lg text-text-secondary hover:bg-background-subtle hover:text-accent-coral transition-colors"
                            title="入力内容を消去"
                        >
                            <Trash2 size={20} />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!inputText.trim() || isSubmitting}
                            className={`
                                p-2 rounded-lg text-white transition-all shadow-sm
                                ${!inputText.trim() || isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-secondary-ocean hover:bg-secondary-ocean-dark active:scale-95'}
                            `}
                            title="保存"
                        >
                            <Check size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Memo List Area */}
            <div className="flex-1 overflow-visible">
                <h3 className="font-bold text-text-secondary mb-3 pl-2 text-sm uppercase tracking-wider">メモ一覧</h3>
                <div className="space-y-3">
                    {memos.length === 0 ? (
                        <div className="text-center py-8 text-text-muted bg-background-paper/50 rounded-xl border border-dashed border-border">
                            保存されたメモはありません
                        </div>
                    ) : (
                        memos.map(memo => (
                            <div key={memo.id} className="group bg-background-paper border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between items-start gap-4">
                                <p className="text-text-main whitespace-pre-wrap text-sm leading-relaxed flex-1 pt-1">
                                    {memo.memo}
                                </p>
                                <button
                                    onClick={() => handleDelete(memo.id)}
                                    className="text-text-muted hover:text-accent-coral hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="削除"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={closeNotification}
                title={notification.title}
                message={notification.message}
                type="alert"
            />
            <ConfirmDialog />
        </div>
    );
};
