'use client';

import React from 'react';
import { useAuth } from '../../features/context/AuthContext';
import { useNotification } from '../../features/notifications/NotificationContext';
import { LogOut, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const AdminHeader = () => {
    const { user, logout } = useAuth();
    const { unreadCount, markAllAsRead } = useNotification();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleNotificationClick = async () => {
        if (unreadCount > 0) {
            // Option 1: Mark read immediately
            // await markAllAsRead(); 
            // Option 2: Navigate to logs (User marks read there or we auto-mark?)
            // Req: "Clicking sends user to..." and "Notification click... -> true"
            // Let's navigate to dashboard which shows the list.
            router.push('/audit-dashboard');
            // Or logs page with filter? 
            // router.push('/logs?action=ANOMALY_DETECTED');
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

                {/* Notification Bell */}
                <button
                    onClick={handleNotificationClick}
                    className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <Bell size={20} className="text-ink" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>

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
