'use client';

import { Sidebar } from '../../components/layout/Sidebar';
import { useAuth } from '../../features/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, logout, isLoading } = useAuth();
    const router = useRouter();

    // Protect Route: If not loading and not user, redirect (and don't render)
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [isLoading, user, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-paper">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-accent-electric"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Don't render content while redirecting
    }

    return (
        <div className="flex min-h-screen bg-paper font-sans selection:bg-accent-electric selection:text-ink">
            {/* Fixed Sidebar/Nav */}
            <div className="fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content Area - Offset for Sidebar */}
            <div className="flex-1 flex flex-col pl-64 relative min-h-screen">
                <AdminHeader />
                <main className="flex-1 p-10 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
