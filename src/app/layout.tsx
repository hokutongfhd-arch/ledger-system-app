import '@/index.css';
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary';
import { NotificationProvider } from '../features/notifications/NotificationContext';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import { ToastProvider } from '@/features/context/ToastContext';
import { AuthProvider } from '@/features/context/AuthContext';
import { DataProvider } from '@/features/context/DataContext';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" suppressHydrationWarning={true}>
            <body className={inter.className} suppressHydrationWarning={true}>
                <GlobalErrorBoundary>
                    <Toaster position="top-right" />
                    <ToastProvider>
                        <AuthProvider>
                            <DataProvider>
                                <NotificationProvider>
                                    <Suspense fallback={<div className="flex items-center justify-center h-screen">読み込み中...</div>}>
                                        {children}
                                    </Suspense>
                                </NotificationProvider>
                            </DataProvider>
                        </AuthProvider>
                    </ToastProvider>
                </GlobalErrorBoundary>
            </body>
        </html>
    );
}
