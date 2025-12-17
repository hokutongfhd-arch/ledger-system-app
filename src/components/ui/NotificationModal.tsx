import React from 'react';
import { Modal } from './Modal';

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'alert' | 'confirm';
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
    isOpen,
    onClose,
    title = '通知',
    message,
    onConfirm,
    confirmText = 'OK',
    cancelText = 'キャンセル',
    type = 'alert',
}) => {
    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose(); // Automatically close after confirm for alerts/confirms usually
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
            <div className="flex flex-col items-center text-center py-4">
                <p className="text-text-main mb-8 whitespace-pre-wrap text-sm">{message}</p>
                <div className="flex gap-4">
                    {type === 'confirm' && (
                        <button
                            onClick={onClose}
                            className="w-24 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className="w-24 py-2 rounded-lg bg-[#0f172a] text-white hover:bg-[#1e293b] transition-colors text-sm font-medium shadow-sm"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
