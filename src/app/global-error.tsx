'use client';

import { useEffect } from 'react';
import { logSystemError } from '@/lib/systemLogger';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logSystemError({
            errorMessage: `致命的なシステムエラー(Root Layout): ${error.message || '不明なエラー'}`,
            context: 'Next.js App Router Boundary (global-error.tsx)',
            errorDetails: {
                message: error.message,
                stack: error.stack,
                digest: error.digest,
            }
        });
    }, [error]);

    return (
        <html lang="ja">
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen bg-background-subtle p-4">
                    <div className="bg-background-paper p-8 rounded-xl shadow-md border border-border max-w-md w-full text-center relative overflow-hidden">
                        <div className="flex justify-center mb-6 relative z-10">
                            <div className="bg-red-50 p-4 rounded-full border border-red-100">
                                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-ink mb-4 relative z-10 leading-relaxed">
                            エラーが発生しました。<br />
                            担当者へご連絡ください
                        </h2>
                        <div className="mt-8 flex justify-center relative z-10">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm text-sm font-medium bg-primary text-white hover:bg-primary-hover"
                            >
                                再読み込み（もう一度試す）
                            </button>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
