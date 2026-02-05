'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X, XCircle, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    description?: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id);
        }, toast.duration || 5000);

        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    const getStyles = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'bg-white border-l-4 border-green-500 text-gray-800 shadow-lg';
            case 'error':
                return 'bg-white border-l-4 border-red-500 text-gray-800 shadow-lg';
            case 'warning':
                return 'bg-white border-l-4 border-yellow-500 text-gray-800 shadow-lg';
            case 'loading':
                return 'bg-white border-l-4 border-blue-400 text-gray-800 shadow-lg';
            case 'info':
            default:
                return 'bg-white border-l-4 border-blue-500 text-gray-800 shadow-lg';
        }
    };

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" size={20} />;
            case 'error': return <XCircle className="text-red-500" size={20} />;
            case 'warning': return <AlertCircle className="text-yellow-500" size={20} />;
            case 'loading': return <Loader2 className="text-blue-400 animate-spin" size={20} />;
            case 'info': default: return <Info className="text-blue-500" size={20} />;
        }
    };

    return (
        <div className={`flex items-start p-4 mb-3 rounded-md min-w-[300px] max-w-md transform transition-all duration-300 translate-x-0 ${getStyles(toast.type)} relative overflow-hidden`}>
            {/* Progress Bar (Optional, can be added later) */}

            <div className="flex-shrink-0 mr-3 mt-0.5">
                {getIcon(toast.type)}
            </div>
            <div className="flex-1 mr-2">
                <h4 className="font-bold text-sm">{toast.message}</h4>
                {toast.description && (
                    <p className="text-xs text-gray-500 mt-1">{toast.description}</p>
                )}
            </div>
            <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
