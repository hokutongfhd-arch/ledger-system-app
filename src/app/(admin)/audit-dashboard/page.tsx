'use client';

import React from 'react';
import { useAuditDashboard } from '../../../features/audit/useAuditDashboard';
import type { ActionTypeStat } from '../../../lib/types/audit';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Activity, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

export default function AuditDashboardPage() {
    const { data, loading, range, setRange } = useAuditDashboard();

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
                <KPICard
                    title="本日の操作数"
                    value={kpi.todayActionCount}
                    icon={<Activity className="text-blue-500" size={24} />}
                />
                <KPICard
                    title="本日の失敗数"
                    value={kpi.todayFailureCount}
                    alert={kpi.todayFailureCount > 0}
                    icon={<AlertTriangle className={kpi.todayFailureCount > 0 ? "text-red-500" : "text-gray-400"} size={24} />}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">操作数推移</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(str) => str.slice(5)} // MM-DD
                                />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="操作数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribution Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">アクション種別</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                >
                                    {distribution.map((entry: ActionTypeStat, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" verticalAlign="bottom" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
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
