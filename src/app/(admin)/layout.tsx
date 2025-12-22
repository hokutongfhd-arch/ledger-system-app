'use client';

import { Sidebar } from '../../components/layout/Sidebar';
import { useAuth } from '../../features/context/AuthContext';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAnomalyMonitor } from '../../features/audit/useAnomalyMonitor';
import { useEffect } from 'react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, logout, isLoading } = useAuth();
    const router = useRouter();

    // Start background anomaly monitoring
    useAnomalyMonitor();

    // Protect Route: If not loading and not user, redirect (and don't render)
    // Actually, middleware handles redirect, but client needs to handle display state.
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

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <div className="flex min-h-screen bg-paper font-sans selection:bg-accent-electric selection:text-ink">
            {/* Fixed Sidebar/Nav */}
            <div className="fixed inset-y-0 left-0 z-50">
                <Sidebar />
            </div>

            {/* Main Content Area - Offset for Sidebar */}
            <div className="flex-1 flex flex-col pl-64 relative min-h-screen">
                <header className="h-20 bg-paper/95 backdrop-blur-sm border-b-2 border-ink flex items-center justify-between px-10 sticky top-0 z-40">
                    <h2 className="text-xl font-display font-bold tracking-tighter text-ink">
                        LEDGER SYSTEM
                        <span className="text-accent-violet ml-1">.</span>
                    </h2>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="font-bold text-ink text-sm font-display tracking-tight">{user?.name}</p>
                            <p className="text-ink-light text-xs tracking-wider uppercase">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 border-2 border-transparent hover:border-ink hover:bg-accent-electric transition-all duration-300 rounded-none group"
                            title="Log Out"
                        >
                            <LogOut size={20} className="text-ink group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </header>
                <main className="flex-1 p-10 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
