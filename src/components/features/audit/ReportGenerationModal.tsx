'use client';

import React, { useState } from 'react';
import { X, Calendar, FileText, Download, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { clsx } from 'clsx';
import { fetchAuditReportData, saveAuditReportHistory } from '@/app/actions/reports';
import { useAuth } from '@/features/context/AuthContext';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { logger } from '@/lib/logger';

interface ReportGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportGenerationModal: React.FC<ReportGenerationModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [reportType, setReportType] = useState<'summary' | 'detailed'>('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<any>(null);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedReport(null);

        try {
            // 1. データの取得
            const result = await fetchAuditReportData(startDate + 'T00:00:00Z', endDate + 'T23:59:59Z');

            if (!result.success) throw new Error(result.error);

            // 2. PDF生成 (本来はここで外部サービスやPlaywrightを叩くが、一旦モック的に完了へ)
            // TODO: jsPDF / react-pdf 等の実装を呼び出す

            // 3. 履歴の保存
            const historyResult = await saveAuditReportHistory({
                report_type: reportType,
                period_start: startDate,
                period_end: endDate,
                summary: result.summary,
                generated_by: user?.code || 'SYSTEM',
                generated_by_name: user?.name || '管理者'
            });

            if (!historyResult.success) throw new Error(historyResult.error);

            setGeneratedReport(historyResult.report);
            toast.success('レポートの生成が完了しました。プレビューから確認・ダウンロードが可能です。');

        } catch (error: any) {
            console.error('Report Generation Error:', error);
            toast.error(`生成に失敗しました: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0E27]/40 backdrop-blur-sm p-4">
            <div className="bg-[#FEFEF8] border-4 border-[#0A0E27] shadow-[12px_12px_0px_0px_#0A0E27] w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-[#0A0E27] p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#00F0FF] text-[#0A0E27]">
                            <FileText size={24} />
                        </div>
                        <h2 className="text-2xl font-bold font-display uppercase tracking-wider">Audit Report Generate</h2>
                    </div>
                    <button onClick={onClose} className="hover:rotate-90 transition-transform">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {!generatedReport ? (
                        <>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest opacity-60">開始日</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full bg-white border-2 border-[#0A0E27] p-3 font-bold focus:bg-[#00F0FF]/10 outline-none transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest opacity-60">終了日</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full bg-white border-2 border-[#0A0E27] p-3 font-bold focus:bg-[#00F0FF]/10 outline-none transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest opacity-60">レポート種別</label>
                                    <div className="p-4 border-2 border-[#0A0E27] bg-[#0A0E27] text-white font-bold shadow-[4px_4px_0px_0px_#00F0FF] flex items-center gap-3">
                                        <FileText size={20} />
                                        概要レポート (Executive Summary)
                                    </div>
                                    <p className="text-[10px] opacity-60 font-medium italic mt-1">※ 現在、監査レポートは概要版のみ提供されています。</p>
                                </div>
                            </div>

                            <div className="bg-[#0A0E27]/5 p-4 border-l-4 border-[#0A0E27] italic text-sm">
                                <p>※ レポートの生成には数秒かかる場合があります。生成後、自動的に証跡としてデータベースに記録されます。</p>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full py-4 bg-[#00F0FF] border-2 border-[#0A0E27] text-[#0A0E27] font-bold text-xl uppercase tracking-widest shadow-[6px_6px_0px_0px_#0A0E27] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download />
                                        レポート生成開始
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-12 space-y-6">
                            <div className="w-20 h-20 bg-[#00F0FF] border-2 border-[#0A0E27] mx-auto flex items-center justify-center">
                                <ShieldCheck size={40} className="text-[#0A0E27]" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold uppercase mb-2">Generation Complete</h3>
                                <p className="text-sm opacity-60">監査レポートの作成と証跡保存が完了しました</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Link
                                    href={`/audit/reports/print?startDate=${startDate}&endDate=${endDate}&type=${reportType}`}
                                    className="block text-center py-3 bg-white border-2 border-[#0A0E27] font-bold shadow-[4px_4px_0px_0px_#0A0E27] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all text-sm leading-normal"
                                >
                                    プレビューを表示
                                </Link>
                                <button
                                    onClick={onClose}
                                    className="py-3 bg-[#0A0E27] text-white border-2 border-[#0A0E27] font-bold shadow-[4px_4px_0px_0px_#00F0FF] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all text-sm"
                                >
                                    閉じる
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
