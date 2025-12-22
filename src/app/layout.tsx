import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../index.css';
import { DataProvider } from '../features/context/DataContext';
import { AuthProvider } from '../features/context/AuthContext';
import { Suspense } from 'react';
import { GlobalErrorBoundary } from '../components/error/GlobalErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: '台帳管理システム',
    description: '社内機器およびマスタの管理システム',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja" suppressHydrationWarning={true}>
            <body className={inter.className}>
                <GlobalErrorBoundary>
                    <AuthProvider>
                        <DataProvider>
                            <Suspense fallback={<div className="flex items-center justify-center h-screen">読み込み中...</div>}>
                                {children}
                            </Suspense>
                        </DataProvider>
                    </AuthProvider>
                </GlobalErrorBoundary>
            </body>
        </html>
    );
}
