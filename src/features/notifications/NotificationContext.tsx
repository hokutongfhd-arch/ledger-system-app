'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface NotificationContextType {
    unreadCount: number;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const router = useRouter();

    // 1. Fetch initial unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const { count, error } = await supabase
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false);

            if (!error && count !== null) {
                setUnreadCount(count);
            }
        } catch (err) {
            console.error('Failed to fetch unread anomalies:', err);
        }
    }, []);

    // 2. Mark All as Read
    const markAllAsRead = async () => {
        try {
            // Optimistic update
            setUnreadCount(0);

            const { error } = await supabase
                .from('audit_logs')
                .update({ is_acknowledged: true })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false);

            if (error) throw error;

            toast.success('全ての通知を既読にしました');
            router.refresh();
        } catch (err) {
            console.error('Failed to acknowledge alerts:', err);
            toast.error('既読設定に失敗しました');
            fetchUnreadCount(); // Revert on error
        }
    };

    // 3. Realtime Subscription
    useEffect(() => {
        fetchUnreadCount();

        const channel = supabase
            .channel('audit-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'audit_logs',
                    filter: "action_type=eq.ANOMALY_DETECTED"
                },
                (payload) => {
                    const newLog = payload.new as any;
                    // Increment count
                    setUnreadCount(prev => prev + 1);

                    // Show Toast
                    toast.error(
                        (t) => (
                            <div className="flex flex-col gap-1 cursor-pointer" onClick={() => router.push('/logs')}>
                                <span className="font-bold text-sm">🚨 異常検知</span>
                                <span className="text-xs">営業時間外のアクセスが検出されました。</span>
                                <span className="text-xs text-gray-500">{newLog.actor_name}</span>
                            </div>
                        ),
                        {
                            duration: 5000,
                            position: 'top-right',
                            style: {
                                border: '1px solid #EF4444',
                                background: '#FEF2F2',
                                color: '#991B1B'
                            }
                        }
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchUnreadCount, router]);

    return (
        <NotificationContext.Provider value={{ unreadCount, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
