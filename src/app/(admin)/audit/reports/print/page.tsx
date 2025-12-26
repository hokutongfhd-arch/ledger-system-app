'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchAuditReportData } from '@/app/actions/reports';
import { format } from 'date-fns';
import {
    Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { ShieldAlert, Activity, AlertTriangle, ShieldCheck, User, Zap, X, FileText, Download, ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/context/AuthContext';
import { clsx } from 'clsx';
import Script from 'next/script';

const ACTION_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: 'ログイン成功',
    LOGIN_FAILURE: 'ログイン失敗',
    LOGOUT: 'ログアウト',
    CREATE: 'データ作成',
    UPDATE: 'データ更新',
    DELETE: 'データ削除',
    ANOMALY_DETECTED: '異常検知',
    EXPORT: 'エクスポート',
    IMPORT: 'インポート',
    DOWNLOAD_TEMPLATE: 'テンプレート読込',
    GENERATE: 'レポート生成',
    ANOMALY_RESPONSE: '不正対応登録'
};

export default function AuditReportPrintPage() {
    const searchParams = useSearchParams();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const reportType = searchParams.get('type') || 'summary';
    const { user } = useAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const downloadedRef = React.useRef(false);
    useEffect(() => {
        if (startDate && endDate) {
            fetchAuditReportData(startDate, endDate).then(res => {
                if (res.success) {
                    setData(res);
                }
                setLoading(false);
            });
        }
    }, [startDate, endDate]);

    const handleAutoDownload = async (reportData: any) => {
        const element = document.getElementById('report-content');
        if (!element) return;

        // キャプチャ前にスクロール位置をトップに強制（ズレ防止）
        window.scrollTo(0, 0);

        const opt = {
            margin: 0,
            filename: `監査レポート_${reportType === 'summary' ? '概要' : '詳細'}_${format(new Date(), 'yyyyMMdd')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollY: 0,
                scrollX: 0,
                backgroundColor: '#FEFEF8',
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        if ((window as any).html2pdf) {
            try {
                await (window as any).html2pdf().set(opt).from(element).save();

                // ダウンロード完了後に親ウィンドウへ通知（iframe内であれば window.parent）
                const messageData = {
                    type: 'PDF_DOWNLOAD_SUCCESS',
                    details: {
                        type: reportType,
                        period: `${startDate} - ${endDate}`
                    }
                };

                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(messageData, '*');
                } else if (window.opener) {
                    window.opener.postMessage(messageData, '*');
                }
            } catch (err) {
                console.error('Download failed:', err);
            }
        } else {
            console.warn('html2pdf not ready, retrying...');
            setTimeout(() => handleAutoDownload(reportData), 500);
        }
    };

    // ダウンロード専用(isHidden)の場合は最小限の表示
    const isHidden = searchParams.get('hidden') === 'true';

    if (loading) return <div className={clsx("p-20 text-center font-bold", isHidden && "sr-only")}>レポート生成中...</div>;
    if (!data) return <div className="p-20 text-center text-red-600 font-bold">エラー: データの読み込みに失敗しました</div>;

    const { summary, anomalies, period } = data;

    return (
        <div className="bg-[#FEFEF8] min-h-screen">
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />

            {!isHidden && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-[#0A0E27] p-4 flex justify-between items-center shadow-lg print:hidden">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => handleAutoDownload(data)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#00F0FF] text-[#0A0E27] font-bold text-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all shadow-[2px_2px_0px_0px_#0A0E27]"
                        >
                            <Download size={18} />
                            PDFをダウンロード
                        </button>
                        <button
                            onClick={() => {
                                window.location.href = '/audit-dashboard';
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B6B] text-white font-bold text-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all shadow-[2px_2px_0px_0px_#0A0E27]"
                        >
                            <X size={18} />
                            ダッシュボードに戻る
                        </button>
                    </div>
                </div>
            )}

            <div className={clsx(!isHidden && "py-24")}>
                <div
                    id="report-content"
                    className={clsx(
                        "bg-white text-[#0A0E27] font-japanese w-[210mm] mx-auto print:p-0 overflow-visible shadow-2xl relative",
                        isHidden ? "mt-0" : ""
                    )}
                >
                    {/* [PAGE 1] COVER PAGE */}
                    <div className="h-[290mm] flex flex-col justify-between border-[12px] border-[#0A0E27] p-16 relative overflow-hidden bg-white">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00F0FF] -rotate-45 translate-x-32 -translate-y-32 border-b-4 border-[#0A0E27]"></div>

                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-[#00F0FF] border-4 border-[#0A0E27] flex items-center justify-center font-display font-black text-3xl italic">A</div>
                                <div className="text-sm font-black uppercase tracking-widest leading-none">
                                    System Management<br />Audit Division
                                </div>
                            </div>

                            <div className="pt-20">
                                <h1 className="text-7xl font-black tracking-tighter leading-none mb-4 font-japanese">
                                    監査レポート<br />
                                    <span className="text-4xl">({format(new Date(period.start), 'yyyy/MM/dd')} 〜 {format(new Date(period.end), 'yyyy/MM/dd')})</span>
                                </h1>
                                <div className="h-4 bg-[#0A0E27] w-full mb-8"></div>
                                <div className="flex gap-12">
                                    <div>
                                        <label className="text-xs font-bold uppercase opacity-40 block mb-1">レポート種別</label>
                                        <span className="text-2xl font-black uppercase bg-[#00F0FF] px-2">{reportType === 'summary' ? '概要レポート' : '詳細レポート'}</span>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase opacity-40 block mb-1">秘匿レベル</label>
                                        <span className="text-2xl font-black uppercase border-2 border-[#0A0E27] px-2">部外秘</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-12">
                            <div className="grid grid-cols-2 gap-12 border-t-4 border-[#0A0E27] pt-8 font-black">
                                <div>
                                    <label className="text-xs font-bold uppercase opacity-40 block mb-2">対象期間</label>
                                    <div className="text-xl">
                                        {format(new Date(period.start), 'yyyy/MM/dd')} - {format(new Date(period.end), 'yyyy/MM/dd')}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase opacity-40 block mb-2">発行日時</label>
                                    <div className="text-xl">{format(new Date(), 'yyyy/MM/dd HH:mm')}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase opacity-40 block mb-2">発行者</label>
                                    <div className="text-xl">{user?.name || 'システム管理者'} ({user?.code || 'admin'})</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase opacity-40 block mb-2">レポート識別ID</label>
                                    <div className="text-xl font-mono italic">#{Math.random().toString(36).substring(7).toUpperCase()}</div>
                                </div>
                            </div>

                            <p className="text-xs font-bold leading-relaxed opacity-60">
                                本レポートはシステム内の各操作ログおよび不正検知アルゴリズムによって自動生成された、改竄不可能な証跡記録です。<br />
                                生成時点のデータベース状態を反映しています。法令遵守および内部統制の観点から、適切に管理・保管を行ってください。
                            </p>
                        </div>
                    </div>

                    {/* [PAGE 2] SUMMARY & DISTRIBUTION */}
                    <div className="html2pdf__page-break" />
                    <div className="min-h-[290mm] h-[290mm] p-20 space-y-12 bg-white relative overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#0A0E27] text-[#0A0E27] flex items-center justify-center font-black text-2xl" style={{ backgroundColor: '#00F0FF' }}>01</div>
                            <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">エグゼクティブ・サマリー</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <KPICardPrint title="総操作数" value={summary.total_actions} icon={<Activity size={24} />} />
                            <KPICardPrint title="異常検知数" value={summary.anomalies} icon={<AlertTriangle size={24} />} alert />
                            <KPICardPrint title="失敗アクション" value={summary.breakdown_by_result?.failure || 0} icon={<ShieldAlert size={24} />} />
                            <KPICardPrint title="未対応件数" value={summary.unacknowledged_anomalies || 0} icon={<Zap size={24} />} alert />
                        </div>

                        <div className="grid grid-cols-2 gap-12 pt-8 chart-container">
                            <div className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-widest opacity-40">アクション別分析</h3>
                                <div className="h-[300px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.distribution}
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={4}
                                                dataKey="count"
                                                nameKey="action"
                                                isAnimationActive={false} // PDF出力時はアニメーションをオフに
                                            >
                                                {data.distribution.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-4xl font-black">{data.distribution.reduce((acc: any, c: any) => acc + c.count, 0)}</span>
                                        <span className="text-[10px] font-bold opacity-40 uppercase">合計</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-sm font-black uppercase tracking-widest opacity-40">内訳詳細</h3>
                                <div className="space-y-3">
                                    {data.distribution.slice(0, 8).map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center border-b-2 border-[#0A0E27]/5 pb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                                <span className="font-bold text-sm truncate max-w-[150px]">{ACTION_LABELS[item.action] || item.action}</span>
                                            </div>
                                            <span className="font-black">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* [PAGE 3] ACTIVITY TREND */}
                    <div className="html2pdf__page-break" />
                    <div className="min-h-[290mm] h-[290mm] p-20 space-y-12 bg-white relative overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#0A0E27] text-[#0A0E27] flex items-center justify-center font-black text-2xl" style={{ backgroundColor: '#00F0FF' }}>02</div>
                            <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">アクティビティトレンド</h2>
                        </div>

                        <div className="bg-white border-4 border-[#0A0E27] p-8 h-[500px] flex flex-col chart-container">
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={{ stroke: '#0A0E27', strokeWidth: 2 }}
                                            tick={{ fill: '#0A0E27', fontSize: 10, fontWeight: 'bold' }}
                                            tickFormatter={(val) => val.split('-').slice(1).join('.')}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tick={{ fill: '#0A0E27', fontSize: 10, fontWeight: 'bold' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            name="総操作数"
                                            stroke="#0A0E27"
                                            strokeWidth={4}
                                            dot={{ r: 4, fill: '#0A0E27', strokeWidth: 0 }}
                                            isAnimationActive={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="anomalyCount"
                                            name="不正検知数"
                                            stroke="#FF6B6B"
                                            strokeWidth={4}
                                            dot={{ r: 4, fill: '#FF6B6B', strokeWidth: 0 }}
                                            isAnimationActive={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-8 flex justify-center gap-12 font-black text-xs uppercase tracking-widest border-t-2 border-[#0A0E27]/5 pt-6">
                                <div className="flex items-center gap-2"><div className="w-8 h-1 bg-[#0A0E27]" /> 総操作数</div>
                                <div className="flex items-center gap-2"><div className="w-8 h-1 bg-[#FF6B6B]" /> 不正検知数</div>
                            </div>
                        </div>

                        <div className="p-8 bg-[#0A0E27]/5 border-l-8 border-[#0A0E27]">
                            <h4 className="text-sm font-black uppercase mb-2">トレンド分析所見</h4>
                            <p className="text-sm font-bold leading-relaxed opacity-70 italic">
                                対象期間内のアクティビティ推移は上記の通りです。急激なスパイクや、特定の時間帯における以上件数の増加が認められる場合は、詳細ログによる個別調査が必要です。
                            </p>
                        </div>
                    </div>

                    {/* [PAGE 4] TOP ACTORS */}
                    <div className="html2pdf__page-break" />
                    <div className="min-h-[290mm] h-[290mm] p-20 space-y-12 bg-white relative overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#0A0E27] text-[#0A0E27] flex items-center justify-center font-black text-2xl" style={{ backgroundColor: '#00F0FF' }}>03</div>
                            <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">重要アクティビティ分析</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <h3 className="text-lg font-black uppercase border-l-8 border-[#00F0FF] pl-4 italic">操作数上位ユーザー</h3>
                                <div className="space-y-2">
                                    {data.topActors.map((actor: any, idx: number) => (
                                        <div key={actor.code} className="flex items-center justify-between border-b-2 border-[#0A0E27]/10 py-3">
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-2xl text-[#00F0FF] italic">0{idx + 1}</span>
                                                <div>
                                                    <p className="font-black">{actor.name}</p>
                                                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{actor.code}</p>
                                                </div>
                                            </div>
                                            <span className="font-black text-2xl">{actor.count} <span className="text-xs opacity-40 font-bold uppercase">Actions</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <h3 className="text-lg font-black uppercase border-l-8 border-[#FF6B6B] pl-4 italic">不正検知上位ユーザー</h3>
                                <div className="space-y-2">
                                    {data.topAnomalyActors.map((actor: any, idx: number) => (
                                        <div key={actor.code} className="flex items-center justify-between border-b-2 border-[#0A0E27]/10 py-3">
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-2xl text-[#FF6B6B] italic">0{idx + 1}</span>
                                                <div>
                                                    <p className="font-black font-japanese">{actor.name}</p>
                                                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{actor.code}</p>
                                                </div>
                                            </div>
                                            <span className="font-black text-2xl text-[#FF6B6B]">{actor.count} <span className="text-xs opacity-40 font-bold uppercase">Alerts</span></span>
                                        </div>
                                    ))}
                                    {data.topAnomalyActors.length === 0 && (
                                        <div className="h-40 flex items-center justify-center border-4 border-dashed border-[#0A0E27]/10 italic font-bold opacity-40">
                                            該当者なし
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 p-12 border-4 border-[#0A0E27] shadow-[12px_12px_0px_0px_#00F0FF]">
                            <h4 className="text-sm font-black uppercase mb-4 tracking-widest">監査上の留意点</h4>
                            <p className="text-sm font-bold leading-relaxed opacity-80">
                                上位ユーザーの操作内容は業務上の必要性に基づくものであるか再確認を推奨します。特に「不正検知」において上位にランクインしているユーザーについては、実行されたアクションの詳細およびその背景について、関連部門と連携し実態調査を行う必要があります。
                            </p>
                        </div>
                    </div>

                    {/* [PAGE 5〜] ANOMALY LIST & TRACEABILITY */}
                    <div className="html2pdf__page-break" />
                    <div className="min-h-[290mm] p-20 space-y-12 bg-white relative">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#0A0E27] text-[#0A0E27] flex items-center justify-center font-black text-2xl" style={{ backgroundColor: '#00F0FF' }}>04</div>
                            <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">異常検知およびトレーサビリティ</h2>
                        </div>

                        <div className="space-y-8">
                            {anomalies.map((ano: any) => (
                                <div key={ano.id} className="border-4 border-[#0A0E27] shadow-[8px_8px_0px_0px_#0A0E27] p-8 break-inside-avoid bg-white relative overflow-hidden">
                                    {ano.severity === 'high' && (
                                        <div className="absolute top-0 right-0 bg-[#FF6B6B] text-white px-12 py-1 rotate-45 translate-x-12 translate-y-2 text-[8px] font-black uppercase tracking-widest">Critical</div>
                                    )}
                                    <div className="flex justify-between items-start mb-6 border-b-4 border-[#0A0E27] pb-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase opacity-40">イベントID: {ano.id}</span>
                                            <h4 className="text-3xl font-black">{format(new Date(ano.timestamp), 'yyyy.MM.dd HH:mm:ss')}</h4>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 text-right">
                                            <div className="text-xs font-black bg-[#FF6B6B] text-white px-3 py-1 uppercase tracking-widest">
                                                重要度: {ano.severity === 'high' ? '高' : ano.severity === 'medium' ? '中' : '低'}
                                            </div>
                                            <div className={clsx(
                                                "text-xs font-black px-3 py-1 uppercase tracking-widest border-2",
                                                ano.status === 'completed' ? "border-[#00F0FF] text-[#0A0E27]" : "border-[#FF6B6B] text-[#FF6B6B]"
                                            )}>
                                                状態: {ano.status === 'completed' ? '対応済（判断記録あり）' : '未対応（判断未実施）'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12 mb-8">
                                        <div>
                                            <label className="text-[10px] font-black uppercase opacity-40 block mb-1">実行者</label>
                                            <div className="text-xl font-black underline decoration-4 underline-offset-4 decoration-[#00F0FF]">{ano.actor}</div>
                                            <div className="text-xs font-bold opacity-40">{ano.actorCode}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase opacity-40 block mb-1">操作対象</label>
                                            <div className="text-xl font-black">{ano.target}</div>
                                            <div className="text-xs font-bold opacity-40 uppercase tracking-widest">{ACTION_LABELS[ano.action] || ano.action}</div>
                                        </div>
                                    </div>

                                    <div className="bg-[#0A0E27]/5 p-8 border-l-[12px] border-[#0A0E27]">
                                        <label className="text-[10px] font-black uppercase opacity-40 block mb-4 leading-none tracking-widest underline decoration-[#0A0E27]/10 underline-offset-4">対応トレーサビリティ履歴</label>
                                        {ano.responseNote ? (
                                            <div className="space-y-6">
                                                <p className="font-bold text-base leading-relaxed italic">「 {ano.responseNote} 」</p>
                                                <div className="pt-4 border-t-2 border-[#0A0E27]/10 flex justify-between items-end">
                                                    <div className="text-[10px] font-black flex items-center gap-6">
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className="opacity-40" />
                                                            <span>対応者: {ano.acknowledged_by || '管理者'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Activity size={14} className="opacity-40" />
                                                            <span>日時: {format(new Date(ano.acknowledged_at), 'yyyy/MM/dd HH:mm')}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-[#00F0FF] text-[#0A0E27] px-4 py-1">
                                                        <ShieldCheck size={18} />
                                                        <span className="text-[10px] font-black uppercase">Verified</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-6 flex flex-col items-center justify-center gap-4 bg-white/50 border-2 border-dashed border-[#FF6B6B]/20">
                                                <AlertTriangle size={32} className="text-[#FF6B6B] opacity-40" />
                                                <div className="text-sm italic text-[#FF6B6B] font-black tracking-widest">対応記録なし。至急確認が必要です。</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {anomalies.length === 0 && (
                                <div className="py-32 text-center border-8 border-dotted border-[#0A0E27]/10 italic font-black text-2xl opacity-20 uppercase tracking-[0.2em]">
                                    No Anomalies Detected in this Period
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer for PDF */}
                    <div className="mt-8 pt-8 border-t-4 border-[#0A0E27]/10 flex justify-between text-[10px] font-black uppercase opacity-40 px-20 pb-12">
                        <div className="flex items-center gap-4">
                            <span className="bg-[#0A0E27] text-white px-2 py-0.5 tracking-tighter italic">Ledger System</span>
                            <span>Audit Intelligence Report v1.2</span>
                        </div>
                        <div className="flex gap-8">
                            <span>Classification: CONFIDENTIAL / INTERNAL USE ONLY</span>
                            <span># {period.start.replace(/-/g, '')}-{period.end.replace(/-/g, '')}</span>
                        </div>
                    </div>

                    <style jsx global>{`
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    @media print {
                        .html2pdf__page-break {
                            display: block;
                            height: 0;
                            page-break-before: always;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        body {
                            background-color: white !important;
                        }
                    }
                    .chart-container {
                        page-break-inside: avoid;
                    }
                  @font-face {
                        font-family: 'Zen Kaku Gothic New';
                        font-weight: 900;
                        src: local('Zen Kaku Gothic New Black');
                    }
                `}</style>
                </div>
            </div>
        </div>
    );
}

function KPICardPrint({ title, value, icon, alert = false }: { title: string, value: any, icon: any, alert?: boolean }) {
    return (
        <div
            className="p-8 border-4 border-[#0A0E27] space-y-4"
            style={{
                backgroundColor: alert ? 'rgba(255, 107, 107, 0.05)' : '#FFFFFF',
                boxShadow: alert ? '6px 6px 0px 0px #FF6B6B' : '6px 6px 0px 0px #00F0FF'
            }}
        >
            <div className="flex justify-between items-start opacity-40">
                <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
                {icon}
            </div>
            <div className="text-5xl font-black font-display">{value.toLocaleString()}</div>
        </div>
    );
}
