
import toast from 'react-hot-toast';

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
                <div className= "flex flex-col gap-2 min-w-[200px]" >
                <span className="font-bold text-red-600 flex items-center gap-2" >
                        ⚠ 異常検知
    </span>
    < span className = "text-sm text-gray-800" >
        { message }
        </span>
{
    options?.actionHref && (
        <a
                            href={ options.actionHref }
    onClick = {() => toast.dismiss(t.id)
}
className = "text-xs bg-red-50 text-red-600 px-2 py-1.5 rounded border border-red-200 text-center hover:bg-red-100 transition-colors font-medium mt-1"
    >
    { options.actionLabel || '詳細を確認' }
    </a>
                    )}
</div>
            ),
{
    duration: 6000,
        position: 'top-right',
            style: {
        border: '1px solid #fee2e2',
            borderLeft: '4px solid #dc2626',
                background: '#fff',
                },
}
        );
    }
};
