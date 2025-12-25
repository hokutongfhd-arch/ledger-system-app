'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

interface NotificationContextType {
    unreadCount: number;
    maxSeverity: SeverityLevel | null;
    markAllAsRead: (silent?: boolean) => Promise<void>;
    refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [maxSeverity, setMaxSeverity] = useState<SeverityLevel | null>(null);
    const router = useRouter();
    const routerRef = useRef(router);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    const getSeverityWeight = useCallback((severity: string): number => {
        switch (severity) {
            case 'critical': return 4;
            case 'high': return 3;
            case 'medium': return 2;
            case 'low': return 1;
            default: return 0;
        }
    }, []);

    const isHigherSeverity = useCallback((a: string, b: string | null): boolean => {
        if (!b) return true;
        return getSeverityWeight(a) > getSeverityWeight(b);
    }, [getSeverityWeight]);

    const fetchUnreadState = useCallback(async () => {
        try {
            const { data, count, error } = await supabase
                .from('audit_logs')
                .select('severity', { count: 'exact' })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false);

            if (error) throw error;

            if (count !== null) {
                setUnreadCount(count);
                let currentMax: SeverityLevel | null = null;
                if (data) {
                    data.forEach((log: any) => {
                        const sev = log.severity || 'medium';
                        if (isHigherSeverity(sev, currentMax)) {
                            currentMax = sev;
                        }
                    });
                }
                setMaxSeverity(currentMax);
            }
        } catch (err) {
            console.error('Failed to fetch unread anomalies:', err);
        }
    }, [isHigherSeverity]);

    const markAllAsRead = useCallback(async (silent: boolean = false) => {
        try {
            setUnreadCount(0);
            setMaxSeverity(null);

            const { error } = await supabase
                .from('audit_logs')
                .update({ is_acknowledged: true })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false);

            if (error) throw error;

            if (!silent) {
                toast.success('全ての通知を既読にしました');
            }
            routerRef.current.refresh();
        } catch (err: any) {
            console.error('Failed to acknowledge alerts:', {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code,
                full: err
            });
            if (!silent) {
                toast.error('既読設定に失敗しました');
            }
            fetchUnreadState();
        }
    }, [fetchUnreadState]);

    useEffect(() => {
        fetchUnreadState();

        const channel = supabase
            .channel('audit-notifications-final')
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
                    const severity = newLog.severity || 'medium';

                    setUnreadCount(prev => prev + 1);
                    setMaxSeverity(prev => isHigherSeverity(severity, prev) ? severity : prev);

                    if (severity === 'low') return;

                    const isCritical = severity === 'critical';
                    const isHigh = severity === 'high';

                    const toastStyle = {
                        border: isCritical ? '1px solid #EF4444' : (isHigh ? '1px solid #F97316' : '1px solid #3B82F6'),
                        background: isCritical ? '#FEF2F2' : (isHigh ? '#FFF7ED' : '#EFF6FF'),
                        color: isCritical ? '#991B1B' : (isHigh ? '#9A3412' : '#1E40AF'),
                    };

                    const icon = isCritical ? '🚨' : (isHigh ? '⚠️' : 'ℹ️');
                    const title = isCritical ? '重大な異常検知' : (isHigh ? '異常検知(High)' : '異常検知');

                    toast.custom(
                        (t) => (
                            <div
                                className="flex flex-col gap-1 cursor-pointer p-4 rounded-lg shadow-lg bg-white border-2"
                                style={{ ...toastStyle, minWidth: '320px', zIndex: 9999 }}
                                onClick={() => {
                                    if (window.location.pathname === '/audit-dashboard') {
                                        window.dispatchEvent(new CustomEvent('refresh-audit-dashboard'));
                                    } else {
                                        routerRef.current.push('/audit-dashboard');
                                    }
                                    toast.dismiss(t.id);
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">{icon}</span>
                                    <span className="font-bold text-sm">{title}</span>
                                </div>
                                <span className="text-xs font-medium">不審な操作が検出されました。</span>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs opacity-80">User: {newLog.actor_name || 'System'}</span>
                                    <span className="text-[10px] opacity-60">Just now</span>
                                </div>
                            </div>
                        ),
                        {
                            duration: isCritical ? Infinity : 8000,
                            position: 'top-right',
                            id: `anomaly-${newLog.id}-${Date.now()}`
                        }
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'audit_logs',
                },
                (payload) => {
                    const newLog = payload.new as any;
                    // If action_type is specified and it's not an anomaly, skip
                    if (newLog.action_type && newLog.action_type !== 'ANOMALY_DETECTED') {
                        return;
                    }
                    // Otherwise (if anomaly or if action_type missing from payload), refetch
                    fetchUnreadState();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchUnreadState, isHigherSeverity]);

    const value = useMemo(() => ({
        unreadCount,
        maxSeverity,
        markAllAsRead,
        refreshNotifications: fetchUnreadState
    }), [unreadCount, maxSeverity, markAllAsRead, fetchUnreadState]);

    return (
        <NotificationContext.Provider value={value}>
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
