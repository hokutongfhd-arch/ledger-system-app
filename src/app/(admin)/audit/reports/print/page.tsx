'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchAuditReportData } from '@/app/actions/reports';
import { format } from 'date-fns';
import { ShieldAlert, Activity, AlertTriangle, ShieldCheck, User, Zap } from 'lucide-react';
import { useAuth } from '@/features/context/AuthContext';
import { clsx } from 'clsx';
import Script from 'next/script';

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
                    // dataがセットされた後のレンダリング完了を待ってからダウンロード
                    if (searchParams.get('download') === 'true' && !downloadedRef.current) {
                        downloadedRef.current = true;
                        // 2秒待ってから確実にキャプチャ
                        setTimeout(() => {
                            handleAutoDownload(res);
                        }, 2000);
                    }
                }
                setLoading(false);
            });
        }
    }, [startDate, endDate]);

    const handleAutoDownload = async (reportData: any) => {
        const element = document.getElementById('report-content');
        if (!element) return;

        const opt = {
            margin: 0,
            filename: `監査レポート_${reportType === 'summary' ? '概要' : '詳細'}_${format(new Date(), 'yyyyMMdd')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 1200
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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
        <div id="report-content" className={clsx(
            "bg-white text-[#0A0E27] font-japanese w-[210mm] mx-auto print:p-0 overflow-visible",
            isHidden && "fixed top-[-10000px] left-[-10000px]" // 画面外に配置
        )}>
            <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />

            {/* [PAGE 1] COVER PAGE */}
            <div className="h-[296mm] flex flex-col justify-between border-[12px] border-[#0A0E27] p-16 relative overflow-hidden bg-white">
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

            {/* [PAGE 2] SUMMARY SECTION */}
            <div className="html2pdf__page-break" />
            <div className="min-h-[296mm] p-20 space-y-12 bg-white relative">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#0A0E27] text-white flex items-center justify-center font-black text-2xl">01</div>
                    <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">エグゼクティブ・サマリー</h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <KPICardPrint title="総操作数" value={summary.total_actions} icon={<Activity size={24} />} />
                    <KPICardPrint title="異常検知数" value={summary.anomalies} icon={<AlertTriangle size={24} />} alert />
                    <KPICardPrint title="失敗アクション" value={summary.breakdown_by_result?.failure || 0} icon={<ShieldAlert size={24} />} />
                    <KPICardPrint title="未対応件数" value={summary.unacknowledged_anomalies || 0} icon={<Zap size={24} />} alert />
                </div>

                <div className="space-y-6 pt-12">
                    <h3 className="text-sm font-black uppercase tracking-widest opacity-40">アクション別内訳</h3>
                    <div className="space-y-2">
                        {Object.entries(summary.breakdown_by_action).map(([key, val]: any) => (
                            <div key={key} className="flex items-center justify-between border-b-2 border-[#0A0E27]/10 py-2">
                                <span className="font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#0A0E27]"></div>
                                    {key}
                                </span>
                                <span className="font-black text-xl">{val} <span className="text-xs opacity-40 font-bold">件</span></span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* [PAGE 3] ANOMALY LIST & TRACEABILITY */}
            <div className="html2pdf__page-break" />
            <div className="min-h-[296mm] p-20 space-y-12 bg-white relative">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#00F0FF] border-4 border-[#0A0E27] text-[#0A0E27] flex items-center justify-center font-black text-2xl">02</div>
                    <h2 className="text-4xl font-black uppercase border-b-4 border-[#0A0E27] pr-12">異常検知およびトレーサビリティ</h2>
                </div>

                <div className="space-y-8">
                    {anomalies.map((ano: any, idx: number) => (
                        <div key={ano.id} className="border-2 border-[#0A0E27] shadow-[6px_6px_0px_0px_#0A0E27] p-8 break-inside-avoid bg-white">
                            <div className="flex justify-between items-start mb-6 border-b-2 border-[#0A0E27] pb-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase opacity-40">イベントID: {ano.id}</span>
                                    <h4 className="text-2xl font-black">{format(new Date(ano.timestamp), 'yyyy.MM.dd HH:mm:ss')}</h4>
                                </div>
                                <div className="flex flex-col items-end gap-2">
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

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="text-[10px] font-black uppercase opacity-40 block mb-1">実行者</label>
                                    <div className="font-bold underline decoration-2">{ano.actor} ({ano.actorCode})</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase opacity-40 block mb-1">操作対象</label>
                                    <div className="font-bold">{ano.target}</div>
                                </div>
                            </div>

                            <div className="bg-[#0A0E27]/5 p-6 border-l-8 border-[#0A0E27]">
                                <label className="text-[10px] font-black uppercase opacity-40 block mb-3 leading-none">対応トレーサビリティ履歴</label>
                                {ano.responseNote ? (
                                    <div className="space-y-4">
                                        <p className="font-bold text-sm leading-relaxed">{ano.responseNote}</p>
                                        <div className="pt-4 border-t border-[#0A0E27]/10 flex justify-between items-end">
                                            <div className="text-[10px] font-black flex items-center gap-4">
                                                <span>対応者: {ano.acknowledged_by || '管理者'}</span>
                                                <span className="opacity-40">対応日時: {format(new Date(ano.acknowledged_at), 'yyyy/MM/dd HH:mm')}</span>
                                            </div>
                                            <ShieldCheck size={20} className="text-[#00F0FF]" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4 italic opacity-40 font-bold text-sm">対応記録なし。至急確認が必要です。</div>
                                )}
                            </div>
                        </div>
                    ))}
                    {anomalies.length === 0 && (
                        <div className="py-20 text-center border-4 border-dashed border-[#0A0E27]/10 italic font-bold">
                            対象期間中に検知された異常はありませんでした。
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="fixed bottom-8 left-12 right-12 flex justify-between text-[10px] font-black uppercase opacity-40 print:hidden invisible">
                <span>Ledger System Audit Report v1.0</span>
                <span>FOR INTERNAL USE ONLY</span>
            </div>

            <style jsx global>{`
                @media print {
                    .page-break-after-always {
                        page-break-after: always;
                    }
                    body {
                        background-color: white !important;
                    }
                }
                @font-face {
                    font-family: 'Zen Kaku Gothic New';
                    font-weight: 900;
                    src: local('Zen Kaku Gothic New Black');
                }
            `}</style>
        </div>
    );
}

function KPICardPrint({ title, value, icon, alert = false }: { title: string, value: any, icon: any, alert?: boolean }) {
    return (
        <div className={clsx(
            "p-8 border-4 border-[#0A0E27] space-y-4",
            alert ? "bg-[#FF6B6B]/5 shadow-[6px_6px_0px_0px_#FF6B6B]" : "bg-white shadow-[6px_6px_0px_0px_#00F0FF]"
        )}>
            <div className="flex justify-between items-start opacity-40">
                <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
                {icon}
            </div>
            <div className="text-5xl font-black font-display">{value.toLocaleString()}</div>
        </div>
    );
}
