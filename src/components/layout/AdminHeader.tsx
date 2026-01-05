'use client';

import React from 'react';
import { useAuth } from '../../features/context/AuthContext';
import { useNotification } from '../../features/notifications/NotificationContext';
import { LogOut, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const AdminHeader = () => {
    const { user, logout } = useAuth();
    const { unreadCount, maxSeverity } = useNotification();
    const router = useRouter();
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const getBadgeColor = () => {
        switch (maxSeverity) {
            case 'critical': return 'bg-red-600';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-yellow-500 text-black'; // Yellow often needs black text
            case 'low': return 'bg-gray-500';
            default: return 'bg-red-500';
        }
    };

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleNotificationClick = async () => {
        if (window.location.pathname === '/audit-dashboard') {
            window.dispatchEvent(new CustomEvent('refresh-audit-dashboard'));
        } else {
            router.push('/audit-dashboard');
        }
    };

    return (
        <header className="h-20 bg-paper/95 backdrop-blur-sm border-b-2 border-ink flex items-center justify-between px-10 sticky top-0 z-40">
            <h2 className="text-xl font-display font-bold tracking-tighter text-ink">
                LEDGER SYSTEM
                <span className="text-accent-violet ml-1">.</span>
            </h2>
            <div className="flex items-center gap-6">

                {/* Notification Bell - Admin Only */}
                {user?.role === 'admin' && (
                    <button
                        onClick={handleNotificationClick}
                        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <Bell size={20} className="text-ink" />
                        {isMounted && unreadCount > 0 && (
                            <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${getBadgeColor()}`}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                )}

                <div className="text-right">
                    <p className="font-bold text-ink text-sm font-display tracking-tight">{user?.name ?? ''}</p>
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
    );
};
