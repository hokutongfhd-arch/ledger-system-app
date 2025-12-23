import toast from 'react-hot-toast';
import Link from 'next/link';
import { X } from 'lucide-react';

interface AnomalyNotificationOptions {
    actionLabel?: string;
    actionHref?: string;
}

export const notifier = {
    /**
     * Show a success toast (Standard)
     */
    success: (message: string) => {
        toast.success(message);
    },

    /**
     * Show an error toast (Standard)
     */
    error: (message: string) => {
        toast.error(message);
    },

    /**
     * Show an anomaly detection toast (Admin specialized)
     * High visibility, persistent (longer duration), with action button
     */
    anomaly: (message: string, options?: AnomalyNotificationOptions) => {
        toast(
            (t) => (
                <div className="flex flex-col gap-2 min-w-[280px] relative pr-6">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="absolute -top-1 -right-1 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                    <span className="font-bold text-red-600 flex items-center gap-2">
                        ⚠ 異常検知
                    </span>
                    <span className="text-sm text-gray-800 leading-relaxed">
                        {message}
                    </span>
                    {options?.actionHref && (
                        <Link
                            href={options.actionHref}
                            onClick={() => toast.dismiss(t.id)}
                            className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded border border-red-200 text-center hover:bg-red-100 transition-colors font-medium mt-2 flex items-center justify-center"
                        >
                            {options.actionLabel || '詳細を確認'}
                        </Link>
                    )}
                </div>
            ),
            {
                duration: Infinity,
                position: 'top-right',
                style: {
                    border: '1px solid #fee2e2',
                    borderLeft: '4px solid #dc2626',
                    background: '#fff',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    padding: '16px',
                },
            }
        );
    }
};
