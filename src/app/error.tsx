'use client';

import { useEffect } from 'react';
import { logSystemError } from '@/lib/systemLogger';
import { AlertTriangle } from 'lucide-react';
import { ActionButton } from '@/components/ui/ActionButton';

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the unhandled error to Supabase in the background
        logSystemError({
            errorMessage: `システムクラッシュエラー: ${error.message || '不明なエラー'}`,
            context: 'Next.js App Router Boundary (error.tsx)',
            errorDetails: {
                message: error.message,
                stack: error.stack,
                digest: error.digest,
            }
        });
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <div className="bg-background-paper p-8 rounded-xl shadow-md border border-border max-w-md w-full text-center">
                <div className="flex justify-center mb-6 z-10 relative">
                    <div className="bg-red-50 p-4 rounded-full border border-red-100">
                        <AlertTriangle className="text-red-500 w-12 h-12" />
                    </div>
                </div>
                <h2 className="text-xl font-bold text-ink mb-4 leading-relaxed">
                    エラーが発生しました。<br />
                    担当者へご連絡ください
                </h2>
                <div className="mt-8 flex justify-center">
                    <ActionButton variant="primary" onClick={() => window.location.reload()}>
                        再読み込み（もう一度試す）
                    </ActionButton>
                </div>
            </div>
        </div>
    );
}
