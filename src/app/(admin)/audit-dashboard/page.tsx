'use client';

import React, { useEffect, useState } from 'react';
import { useAuditDashboard } from '../../../features/audit/useAuditDashboard';
import { useNotification } from '../../../features/notifications/NotificationContext';
import {
    Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Activity, AlertTriangle, ShieldAlert, ArrowRight, ShieldCheck, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import LogDetailModal from '../../../components/features/logs/LogDetailModal';
import { useAuditLogs } from '../../../features/logs/useAuditLogs';
import { ReportGenerationModal } from '../../../components/features/audit/ReportGenerationModal';

export default function AuditDashboardPage() {
    const { data, loading, range, setRange, refresh } = useAuditDashboard();
    const { refreshNotifications } = useNotification();
    const { submitResponse } = useAuditLogs();
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Listen for manual refresh requests
    useEffect(() => {
        const handleRefresh = () => refresh();
        window.addEventListener('refresh-audit-dashboard', handleRefresh);
        return () => window.removeEventListener('refresh-audit-dashboard', handleRefresh);
    }, [refresh]);

    // Keep selectedLog in sync with refreshed data
    useEffect(() => {
        if (selectedLog && data?.recentAnomalies) {
            const updated = data.recentAnomalies.find((l: any) => l.id === selectedLog.id);
            if (updated) {
                if (JSON.stringify(updated) !== JSON.stringify(selectedLog)) {
                    setSelectedLog(updated);
                }
            }
        }
    }, [data?.recentAnomalies, selectedLog]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#FEFEF8]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-10 w-10 bg-[#00F0FF] rounded-lg shadow-sm border-2 border-[#0A0E27]"></div>
                    <span className="text-[#0A0E27]/50 font-display">データを読み込み中...</span>
                </div>
            </div>
        );
    }

    if (!data) return <div>No Data</div>;

    const { kpi, trend, distribution, recentAnomalies, topActors, topAnomalyActors } = data;

    return (
        <div className="bg-[#FEFEF8] min-h-screen -m-8 p-8 font-japanese text-[#0A0E27]">
            {/* Header */}
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-[#0A0E27] pb-8">
                <div>
                    <h1 className="text-5xl font-bold font-display tracking-tight text-[#0A0E27] mb-2 uppercase">
                        監査ダッシュボード
                    </h1>
                    <p className="text-lg opacity-70 font-display italic">システム稼働状況および行動分析レポート</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-white p-1 rounded-sm border-2 border-[#0A0E27] shadow-[2px_2px_0px_0px_#0A0E27]">
                        {(['today', '7days', '30days'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-6 py-2 text-sm font-bold font-display transition-all ${range === r
                                    ? 'bg-[#00F0FF] text-[#0A0E27]'
                                    : 'text-[#0A0E27]/40 hover:text-[#0A0E27]'
                                    }`}
                            >
                                {r === 'today' ? '今日' : r === '7days' ? '7日間' : '30日間'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-3 px-8 py-3 bg-[#0A0E27] text-white font-bold font-display uppercase tracking-widest border-2 border-[#0A0E27] shadow-[6px_6px_0px_0px_#00F0FF] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all active:scale-95"
                    >
                        <FileText size={20} className="text-[#00F0FF]" />
                        レポート生成
                    </button>
                </div>
            </header>

            <main className="space-y-12">
                {/* [01] SYSTEM HEALTH OVERVIEW */}
                <section>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#0A0E27] flex items-center justify-center font-display font-bold text-xl">01</div>
                        <h2 className="text-3xl font-bold uppercase font-display border-b-2 border-[#0A0E27] pr-8">システムヘルス</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        <KPICard
                            title="未対応の不正検知"
                            value={kpi.unacknowledgedAnomalyCount}
                            alert={kpi.unacknowledgedAnomalyCount > 0}
                            subtext={kpi.unacknowledgedAnomalyCount > 0 ? "即時の対応が必要です" : "現在、未対応の項目はありません"}
                            icon={<ShieldAlert size={20} />}
                        />
                        <KPICard
                            title={`${range === 'today' ? '本日' : '期間中'}の総操作数`}
                            value={kpi.todayActionCount}
                            subtext="記録された全ログ数"
                            icon={<Activity size={20} />}
                        />
                        <KPICard
                            title="操作失敗件数"
                            value={kpi.todayFailureCount}
                            subtext={`${range === 'today' ? '本日' : '表示期間中'}の実行失敗`}
                            icon={<ShieldAlert size={20} />}
                        />
                        <KPICard
                            title="ログイン失敗数"
                            value={kpi.loginFailureCount24h}
                            subtext={`${range === 'today' ? '本日' : '表示期間中'}の失敗件数`}
                            icon={<User size={20} />}
                        />
                        <KPICard
                            title="特権管理者操作"
                            value={kpi.adminActionCount}
                            subtext="作成・更新・削除"
                            icon={<ShieldCheck size={20} />}
                        />
                    </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                    {/* [02] SECURITY ALERTS */}
                    <section className="xl:col-span-12">
                        <div className="flex items-center justify-between gap-4 mb-6 border-b-2 border-[#0A0E27] pb-2">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#0A0E27] flex items-center justify-center font-display font-bold text-xl">02</div>
                                <h2 className="text-3xl font-bold uppercase font-display">セキュリティアラート</h2>
                            </div>
                            {recentAnomalies.length > 0 && <span className="bg-[#FF6B6B] text-white px-3 py-1 text-xs font-bold font-display uppercase tracking-widest animate-pulse">緊急確認事項あり</span>}
                        </div>
                        <div className={clsx(
                            "bg-white border-2 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-8",
                            recentAnomalies.length > 0 && recentAnomalies.some(a => !a.is_acknowledged && (a.severity === 'high' || a.severity === 'critical')) && 'ring-4 ring-[#FF6B6B] ring-inset'
                        )}>
                            {recentAnomalies.length > 0 ? (
                                <div className="space-y-4 overflow-x-auto">
                                    <table className="w-full text-left min-w-[600px]">
                                        <thead>
                                            <tr className="border-b border-[#0A0E27]/10 text-xs font-display font-bold uppercase tracking-tighter opacity-50">
                                                <th className="py-2">発生日時</th>
                                                <th className="py-2">実行ユーザー</th>
                                                <th className="py-2">アクション</th>
                                                <th className="py-2">重要度</th>
                                                <th className="py-2 text-right px-4">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#0A0E27]/5">
                                            {recentAnomalies.map((log) => {
                                                const isUnacked = !log.is_acknowledged;
                                                const isHighRisk = log.severity === 'high' || log.severity === 'critical';

                                                return (
                                                    <tr
                                                        key={log.id}
                                                        className={clsx(
                                                            "group transition-colors cursor-pointer",
                                                            isUnacked ? "hover:bg-[#00F0FF]/5" : "opacity-40 grayscale-[0.5] hover:opacity-70"
                                                        )}
                                                        onClick={() => setSelectedLog(log)}
                                                    >
                                                        <td className="py-4 font-display font-medium text-sm whitespace-nowrap">
                                                            {format(new Date(log.timestamp), 'yyyy.MM.dd HH:mm:ss')}
                                                        </td>
                                                        <td className="py-4 font-bold">
                                                            <div className="flex flex-col">
                                                                <span>{log.actorName}</span>
                                                                <span className="text-[10px] opacity-50 font-display font-medium">({log.actorEmployeeCode})</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4">
                                                            <span className={clsx(
                                                                "text-[10px] px-2 py-0.5 font-bold shadow-sm whitespace-nowrap",
                                                                isUnacked ? "bg-[#0A0E27] text-white" : "bg-gray-200 text-gray-600"
                                                            )}>
                                                                {ACTION_LABELS[log.actionRaw] || log.actionRaw}
                                                            </span>
                                                        </td>
                                                        <td className="py-4">
                                                            <div className="flex items-center gap-2">
                                                                <SeverityChip severity={log.severity || 'medium'} />
                                                                {isUnacked && isHighRisk && (
                                                                    <span className="text-[8px] font-black bg-[#FF6B6B] text-white px-1 animate-pulse">要対応</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-4 text-right px-4">
                                                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                                                <span className={clsx(
                                                                    "text-[10px] font-bold px-2 py-0.5 rounded shadow-sm",
                                                                    isUnacked ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                                                )}>
                                                                    {isUnacked ? '未対応（判断未実施）' : '対応済（判断記録あり）'}
                                                                </span>
                                                                <div className="flex items-center text-[#00F0FF] opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                                    <ArrowRight size={14} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center text-[#0A0E27]/40 italic">
                                    <ShieldCheck size={48} className="mb-4 opacity-20" />
                                    <p className="text-xl font-bold font-display uppercase tracking-widest mb-1">Clear</p>
                                    <p className="text-sm font-medium">現在、未対応の不正検知はありません。監査ログは正常に記録されています。</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* [03] ACTIVITY TRENDS */}
                    <section className="xl:col-span-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#0A0E27] flex items-center justify-center font-display font-bold text-xl">03</div>
                            <h2 className="text-3xl font-bold uppercase font-display border-b-2 border-[#0A0E27] pr-8">アクティビティトレンド</h2>
                        </div>
                        <div className="bg-white border-2 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-8 h-[540px] flex flex-col">
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={{ stroke: '#0A0E27', strokeWidth: 1 }}
                                            tickLine={false}
                                            tick={{ fill: '#0A0E27', fontSize: 10, fontWeight: 'bold' }}
                                            tickFormatter={(val) => {
                                                if (val.includes(':')) return val; // Time format HH:00
                                                return val.split('-').slice(1).join('.'); // Date format MM.DD
                                            }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#0A0E27', fontSize: 10, fontWeight: 'bold' }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#FEFEF8', border: '2px solid #0A0E27', borderRadius: '0', fontSize: '12px', fontFamily: 'Zen Kaku Gothic New' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Line type="monotone" dataKey="count" name="総操作数" stroke="#0A0E27" strokeWidth={2} dot={{ r: 4, fill: '#0A0E27' }} />
                                        <Line type="monotone" dataKey="anomalyCount" name="不正検知数" stroke="#FF6B6B" strokeWidth={2} dot={{ r: 4, fill: '#FF6B6B' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-6 flex justify-center gap-12 font-japanese text-[10px] font-bold uppercase tracking-widest opacity-60">
                                <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#0A0E27]" /> 総操作数</div>
                                <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-[#FF6B6B]" /> 不正検知数</div>
                            </div>
                        </div>
                    </section>

                    {/* [04] BREAKDOWN */}
                    <section className="xl:col-span-4">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#0A0E27] flex items-center justify-center font-display font-bold text-xl">04</div>
                            <h2 className="text-3xl font-bold uppercase font-display border-b-2 border-[#0A0E27] pr-8">内訳分析</h2>
                        </div>
                        <div className="bg-white border-2 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-6 h-[540px] flex flex-col">
                            <h3 className="text-sm font-bold uppercase font-display mb-8 opacity-50 tracking-tighter">アクション別構成比</h3>
                            <div className="h-[220px] min-h-[220px] relative mb-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={distribution}
                                            innerRadius={65}
                                            outerRadius={90}
                                            paddingAngle={4}
                                            dataKey="count"
                                            nameKey="action"
                                        >
                                            {distribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-4xl font-bold font-display">{distribution.reduce((acc, c) => acc + c.count, 0)}</span>
                                    <span className="text-[10px] font-bold font-display opacity-40 uppercase">合計件数</span>
                                </div>
                            </div>
                            <div className="space-y-2 overflow-y-auto flex-1">
                                {distribution.slice(0, 10).map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                            <span className="font-bold truncate max-w-[120px]">{ACTION_LABELS[item.action] || item.action}</span>
                                        </div>
                                        <span className="font-display font-bold opacity-60">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                {/* [05] TOP ACTORS */}
                <section>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#0A0E27] flex items-center justify-center font-display font-bold text-xl">05</div>
                        <h2 className="text-3xl font-bold uppercase font-display border-b-2 border-[#0A0E27] pr-8">重要アクティビティ</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="bg-white border-2 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-8">
                            <h3 className="text-sm font-bold uppercase font-display mb-6 border-b border-[#0A0E27]/10 pb-2">操作数上位ユーザー</h3>
                            <div className="space-y-4">
                                {topActors.map((actor, idx) => (
                                    <div key={actor.code} className="flex items-center justify-between border-b border-[#0A0E27]/5 pb-2">
                                        <div className="flex items-center gap-4">
                                            <span className="font-display font-bold text-[#00F0FF] text-xl">0{idx + 1}</span>
                                            <div>
                                                <p className="font-bold underline decoration-[#00F0FF] decoration-2 underline-offset-2">{actor.name}</p>
                                                <p className="text-[10px] font-display font-medium opacity-50">{actor.code}</p>
                                            </div>
                                        </div>
                                        <span className="font-display font-bold text-xl">{actor.count} <span className="text-[10px] opacity-40">件</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white border-2 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-8">
                            <h3 className="text-sm font-bold uppercase font-display mb-6 border-b border-[#0A0E27]/10 pb-2">不正検知ホットスポット</h3>
                            <div className="space-y-4">
                                {topAnomalyActors.map((actor, idx) => (
                                    <div key={actor.code} className="flex items-center justify-between border-b border-[#0A0E27]/5 pb-2">
                                        <div className="flex items-center gap-4">
                                            <span className="font-display font-bold text-[#FF6B6B] text-xl">0{idx + 1}</span>
                                            <div>
                                                <p className="font-bold underline decoration-[#FF6B6B] decoration-2 underline-offset-2">{actor.name}</p>
                                                <p className="text-[10px] font-display font-medium opacity-50">{actor.code}</p>
                                            </div>
                                        </div>
                                        <span className="font-display font-bold text-xl text-[#FF6B6B]">{actor.count} <span className="text-[10px] opacity-40">件</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Modals */}
            {selectedLog && (
                <LogDetailModal
                    key={selectedLog.id}
                    log={selectedLog}
                    isOpen={!!selectedLog}
                    onClose={() => setSelectedLog(null)}
                    onSubmitResponse={async (logId, status, note, adminUserId) => {
                        const res = await submitResponse(logId, status, note, adminUserId);
                        if (res.success) {
                            refresh();
                            setTimeout(() => refreshNotifications(), 500);
                        }
                        return res;
                    }}
                    isDashboardContext={true}
                />
            )}

            <ReportGenerationModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />
        </div>
    );
}

// Sub-components
function KPICard({ title, value, icon, alert = false, subtext }: { title: string, value: number, icon: React.ReactNode, alert?: boolean, subtext?: string }) {
    return (
        <div className={`relative bg-white border-2 border-[#0A0E27] p-6 shadow-[4px_4px_0px_0px_#0A0E27] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0A0E27] ${alert ? 'border-[#FF6B6B] ring-2 ring-[#FF6B6B] ring-inset' : ''}`}>
            <div className="flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-6">
                    <span className="text-[10px] font-bold font-display uppercase tracking-widest opacity-60 leading-none">{title}</span>
                    <div className={`${alert ? 'text-[#FF6B6B]' : 'text-[#00F0FF]'}`}>{icon}</div>
                </div>
                <div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold font-display leading-none ${alert ? 'text-[#FF6B6B]' : ''}`}>{value.toLocaleString()}</span>
                        {alert && <span className="text-[10px] font-bold font-display text-[#FF6B6B] animate-pulse">!</span>}
                    </div>
                    {subtext && <p className="text-[10px] font-bold italic mt-2 opacity-50">{subtext}</p>}
                </div>
            </div>
        </div>
    );
}

function SeverityChip({ severity }: { severity: string }) {
    const styles = {
        critical: 'bg-[#FF6B6B] text-white',
        high: 'bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/20',
        medium: 'bg-[#EAB308]/10 text-[#B45309] border border-[#EAB308]/20',
        low: 'bg-[#0A0E27]/5 text-[#0A0E27]/40 border border-[#0A0E27]/10'
    };
    const labels: Record<string, string> = {
        critical: '重大',
        high: '高',
        medium: '中',
        low: '低'
    };
    return (
        <span className={`text-[10px] font-display font-bold px-2.5 py-1 tracking-wider ${styles[severity as keyof typeof styles] || styles.medium}`}>
            {labels[severity as keyof typeof styles] || severity}
        </span>
    );
}

const ACTION_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: 'ログイン成功',
    LOGIN_FAILURE: 'ログイン失敗',
    LOGOUT: 'ログアウト',
    CREATE: 'データ作成',
    UPDATE: 'データ更新',
    DELETE: 'データ削除',
    ANOMALY_DETECTED: '不正検知',
    EXPORT: 'エクスポート',
    IMPORT: 'インポート',
    DOWNLOAD_TEMPLATE: 'テンプレート読込',
    GENERATE: 'レポート生成',
    ANOMALY_RESPONSE: '対応内容登録'
};
