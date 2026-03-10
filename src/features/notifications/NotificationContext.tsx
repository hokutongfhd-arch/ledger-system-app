'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
    const supabase = createClientComponentClient();
    const [unreadCount, setUnreadCount] = useState(0);
    const [maxSeverity, setMaxSeverity] = useState<SeverityLevel | null>(null);
    const router = useRouter();
    const routerRef = useRef(router);
    const lastAnomalyRef = useRef<{ actor: string, target: string, timestamp: number } | null>(null);
    // ポーリング用のインターバルRef
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            // まず件数のみ取得（severity カラムが存在しない場合に備えてフォールバックを用意）
            const { data, count, error } = await supabase
                .from('audit_logs')
                .select('severity, is_acknowledged', { count: 'exact' })
                .eq('action_type', 'ANOMALY_DETECTED')
                .eq('is_acknowledged', false);

            if (error) {
                const { count: fallbackCount, error: fallbackError } = await supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('action_type', 'ANOMALY_DETECTED')
                    .eq('is_acknowledged', false);

                if (fallbackError) {
                    // 長時間放置によるセッション切れやネットワークエラーで空のオブジェクトが返されることがあるため、エラー表示を抑制
                    if (Object.keys(fallbackError).length > 0 && fallbackError.message) {
                        console.warn('fetchUnreadState fallback error:', fallbackError.message);
                    }
                    return;
                }

                if (fallbackCount !== null) {
                    setUnreadCount(fallbackCount);
                    // severity が取れない場合は medium をデフォルトとして扱う
                    if (fallbackCount > 0) {
                        setMaxSeverity(prev => prev ?? 'medium');
                    } else {
                        setMaxSeverity(null);
                    }
                }
                return;
            }

            if (count !== null) {
                setUnreadCount(count);
                let currentMax: SeverityLevel | null = null;
                if (data) {
                    data.forEach((log: any) => {
                        const sev = log.severity || 'medium';
                        if (isHigherSeverity(sev, currentMax)) {
                            currentMax = sev as SeverityLevel;
                        }
                    });
                }
                setMaxSeverity(currentMax);
            }
        } catch (err) {
            // ネットワークエラー等は静かに無視する
        }
    }, [isHigherSeverity, supabase]);

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
            // 楽観的更新を元に戻す
            fetchUnreadState();
        }
    }, [fetchUnreadState, supabase]);

    useEffect(() => {
        // 初回フェッチ
        fetchUnreadState();

        // =========================================================
        // 30秒ごとのポーリング（ログイン失敗等でリアルタイムが
        // 届かないケースをカバーする保険として追加）
        // =========================================================
        pollingRef.current = setInterval(() => {
            fetchUnreadState();
        }, 30000);

        // =========================================================
        // ページフォーカス時に再取得（ブラウザタブを切り替えた後に
        // バッジが古い状態で表示される問題を解消）
        // =========================================================
        const handleFocus = () => {
            fetchUnreadState();
        };
        window.addEventListener('focus', handleFocus);

        // =========================================================
        // ログイン成功後などにカスタムイベントで即時再取得
        // AuthContext.tsx 側で window.dispatchEvent(new CustomEvent('notification-refresh'))
        // を呼ぶことで、router.refresh() による State リセット後でも
        // 最新バッジ数を即座に反映できる
        // =========================================================
        const handleNotificationRefresh = () => {
            fetchUnreadState();
        };
        window.addEventListener('notification-refresh', handleNotificationRefresh);

        // =========================================================
        // Realtime: INSERT（新しいアラートが来た時）
        // =========================================================
        const channel = supabase
            .channel('audit-notifications-v2')
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
                    const actorCode = newLog.actor_employee_code || 'N/A';
                    const targetType = newLog.target_type || 'N/A';
                    const now = Date.now();

                    // 連続検知チェック（同一 actor + 同一 target + 30秒以内）
                    const isConsecutive = lastAnomalyRef.current &&
                        lastAnomalyRef.current.actor === actorCode &&
                        lastAnomalyRef.current.target === targetType &&
                        (now - lastAnomalyRef.current.timestamp < 30000);

                    lastAnomalyRef.current = { actor: actorCode, target: targetType, timestamp: now };

                    // カウントとseverityの即時更新（楽観的更新）
                    setUnreadCount(prev => prev + 1);
                    setMaxSeverity(prev => isHigherSeverity(severity, prev) ? severity as SeverityLevel : prev);

                    // low の場合はトースト通知しない
                    if (severity === 'low') return;

                    const isCritical = severity === 'critical';
                    const isHigh = severity === 'high';

                    const toastStyle = {
                        border: isCritical ? '1px solid #EF4444' : (isHigh ? '1px solid #F97316' : '1px solid #3B82F6'),
                        background: isCritical ? '#FEF2F2' : (isHigh ? '#FFF7ED' : '#EFF6FF'),
                        color: isCritical ? '#991B1B' : (isHigh ? '#9A3412' : '#1E40AF'),
                    };

                    const icon = isCritical ? '🛡️' : (isHigh ? '⚠️' : 'ℹ️');
                    const title = isCritical ? '重大な不正検知' : (isHigh ? '不正検知（高）' : '不正検知');
                    const subtitle = isConsecutive ? '（連続発生）' : '';

                    let message = '不審な操作が検出されました。';
                    if (isCritical) {
                        const metaMsg = newLog.metadata?.message;
                        message = metaMsg ? `${metaMsg}` : `重大なセキュリティリスクが検知されました: [${newLog.target_type}]`;
                    } else if (isHigh) {
                        message = '高レベルの不正が検出されました。早急な確認を推奨します。';
                    }

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
                                    <span className="font-bold text-sm">{title} <span className="text-[#FF6B6B]">{subtitle}</span></span>
                                </div>
                                <span className="text-xs font-medium leading-relaxed">{message}</span>
                                <div className="flex justify-between items-center mt-1 pt-1 border-t border-black/5">
                                    <span className="text-[10px] font-bold">Actor: {newLog.actor_name || actorCode}</span>
                                    <span className="text-[10px] opacity-60 uppercase font-display">Priority: {severity}</span>
                                </div>
                            </div>
                        ),
                        {
                            duration: isCritical ? Infinity : 10000,
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
                    // ANOMALY_DETECTED の既読状態が変わった場合は再フェッチ
                    if (newLog.action_type && newLog.action_type !== 'ANOMALY_DETECTED') {
                        return;
                    }
                    fetchUnreadState();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // サブスクライブ成功時に一度フェッチして最新状態を確保
                    fetchUnreadState();
                }
            });

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('notification-refresh', handleNotificationRefresh);
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [fetchUnreadState, isHigherSeverity, supabase]);

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
