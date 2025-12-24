'use client';

import React, { useEffect } from 'react';
import { useAuditDashboard } from '../../../features/audit/useAuditDashboard';
import { useNotification } from '../../../features/notifications/NotificationContext';
import type { ActionTypeStat } from '../../../lib/types/audit';
import {
    Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Activity, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';
import { renderCustomizedLabel } from './PieLabel';

export default function AuditDashboardPage() {
    const { data, loading, range, setRange } = useAuditDashboard();
    const { markAllAsRead } = useNotification();

    // Sort logic: Descending order by count
    const chartData = React.useMemo(() => {
        if (!data?.distribution) return [];
        return [...data.distribution].sort((a, b) => b.count - a.count);
    }, [data?.distribution]);

    // Automatically mark notifications as read when entering the dashboard
    useEffect(() => {
        markAllAsRead(true); // Added 'silent' flag to prevent annoying toast on auto-clear
    }, [markAllAsRead]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (!data) return <div>No Data</div>;

    const { kpi, trend, distribution } = data;

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">監査ダッシュボード</h1>
                    <p className="text-sm text-gray-500">システム利用状況とセキュリティ状態のサマリー</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {(['today', '7days', '30days'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${range === r
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {r === 'today' ? '今日' : r === '7days' ? '7日間' : '30日間'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Phase 6-3: Unacknowledged Anomalies */}
                <KPICard
                    title="未確認の異常"
                    value={kpi.unacknowledgedAnomalyCount}
                    alert={kpi.unacknowledgedAnomalyCount > 0}
                    subtext="要確認"
                    icon={<AlertTriangle className={kpi.unacknowledgedAnomalyCount > 0 ? "text-red-600" : "text-gray-400"} size={24} />}
                />
                <KPICard
                    title="本日の操作数"
                    value={kpi.todayActionCount}
                    icon={<Activity className="text-blue-500" size={24} />}
                />
                <KPICard
                    title="本日の失敗数"
                    value={kpi.todayFailureCount}
                    alert={kpi.todayFailureCount > 0}
                    icon={<AlertTriangle className={kpi.todayFailureCount > 0 ? "text-amber-500" : "text-gray-400"} size={24} />}
                />
                <KPICard
                    title="ログイン失敗 (24h)"
                    value={kpi.loginFailureCount24h}
                    alert={kpi.loginFailureCount24h > 0}
                    subtext="直近24時間"
                    icon={<ShieldAlert className={kpi.loginFailureCount24h > 0 ? "text-red-500" : "text-gray-400"} size={24} />}
                />
                <KPICard
                    title="管理者操作"
                    value={kpi.adminActionCount}
                    subtext="Create / Update / Delete"
                    icon={<CheckCircle className="text-green-500" size={24} />}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6">
                {/* Distribution Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">アクション種別</h3>
                    <div className="flex flex-col md:flex-row h-full gap-8">
                        {/* 1. Clean Chart Area (Left Side) - Increased width and reduced radius to prevent clipping */}
                        <div className="h-[350px] md:h-[400px] w-full md:w-[60%] shrink-0 relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 40, right: 110, bottom: 40, left: 110 }}>
                                    <Pie
                                        style={{ outline: 'none' }}
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={2}
                                        startAngle={90} // Start from top (12 o'clock)
                                        endAngle={-270} // Go clockwise
                                        dataKey="count"
                                        nameKey="action" // Needed for label to access 'name'
                                        label={renderCustomizedLabel} // Use custom label
                                        labelLine={false} // Disable default lines as custom renderer handles them
                                    >
                                        {chartData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                        ))}
                                    </Pie>

                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text (Total) */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center">
                                    <span className="block text-2xl font-bold text-gray-800">
                                        {distribution.reduce((acc, curr) => acc + curr.count, 0)}
                                    </span>
                                    <span className="text-xs text-gray-400">TOTAL</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Detailed List Area (Right Side) */}
                        <div className="flex-1 overflow-y-auto mt-2 md:mt-0 pr-2 space-y-3 custom-scrollbar flex flex-col justify-center">
                            {distribution.map((item, i) => {
                                const total = distribution.reduce((acc, curr) => acc + curr.count, 0);
                                const percent = total > 0 ? (item.count / total * 100).toFixed(0) : '0';

                                return (
                                    <div key={i} className="flex items-center justify-between text-base p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-4 h-4 rounded-full shrink-0"
                                                style={{ backgroundColor: item.fill }}
                                            />
                                            <span className="text-gray-700 font-medium">
                                                {item.action}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <span className="text-gray-900 font-bold text-lg">{percent}%</span>
                                            <span className="text-gray-500 w-[60px] text-right">{item.count}件</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Severity Chart (New) */}
                {data.severityDistribution && data.severityDistribution.length > 0 && (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">不正検知 重要度内訳</h3>
                        <div className="flex flex-col md:flex-row h-full gap-8">
                            <div className="h-[350px] w-full md:w-[60%] shrink-0 relative flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 40, right: 110, bottom: 40, left: 110 }}>
                                        <Pie
                                            style={{ outline: 'none' }}
                                            data={data.severityDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={2}
                                            startAngle={90}
                                            endAngle={-270}
                                            dataKey="count"
                                            nameKey="severity"
                                            label={renderCustomizedLabel}
                                            labelLine={false}
                                        >
                                            {data.severityDistribution.map((entry, index) => (
                                                <Cell key={`sev-cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Text (Total) */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <span className="block text-2xl font-bold text-gray-800">
                                            {data.severityDistribution.reduce((acc, curr) => acc + curr.count, 0)}
                                        </span>
                                        <span className="text-xs text-gray-400">TOTAL</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto mt-2 md:mt-0 pr-2 space-y-3 custom-scrollbar flex flex-col justify-center">
                                {data.severityDistribution.map((item, i) => {
                                    const total = data.severityDistribution.reduce((acc, curr) => acc + curr.count, 0);
                                    const percent = total > 0 ? (item.count / total * 100).toFixed(0) : '0';

                                    return (
                                        <div key={i} className="flex items-center justify-between text-base p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0">
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-4 h-4 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.fill }}
                                                />
                                                <span className="text-gray-700 font-medium capitalize">
                                                    {item.severity}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="text-gray-900 font-bold text-lg">{percent}%</span>
                                                <span className="text-gray-500 w-[60px] text-right">{item.count}件</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}

function KPICard({ title, value, icon, alert = false, subtext }: { title: string, value: number, icon: React.ReactNode, alert?: boolean, subtext?: string }) {
    return (
        <div className={`bg-white p-5 rounded-xl border shadow-sm transition-all ${alert ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-gray-500">{title}</span>
                {icon}
            </div>
            <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>
                    {value.toLocaleString()}
                </span>
                {subtext && <span className="text-xs text-gray-400 mb-1">{subtext}</span>}
            </div>
        </div>
    );
}
