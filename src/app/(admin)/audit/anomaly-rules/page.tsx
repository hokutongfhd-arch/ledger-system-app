'use client';

import { useState, useEffect } from 'react';
import { auditService, AnomalyRule } from '../../../../features/audit/audit.service';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useToast } from '../../../../features/context/ToastContext';
import { useAuth } from '../../../../features/context/AuthContext';
import { useData } from '../../../../features/context/DataContext';
import { Shield, Settings, AlertTriangle, Save, RefreshCcw, Bell, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

export default function AnomalyRulesPage() {
    const [rules, setRules] = useState<AnomalyRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingParams, setPendingParams] = useState<Record<string, any>>({});
    const [pendingSeverity, setPendingSeverity] = useState<Record<string, AnomalyRule['severity']>>({});
    const { confirm, ConfirmDialog } = useConfirm();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { employees } = useData();

    // Get current user for logging
    const currentUser = employees.find(e => e.id === user?.id);
    const actor = {
        name: currentUser?.name || user?.name || 'Unknown Admin',
        employeeCode: currentUser?.code || user?.code
    };

    const fetchRules = async () => {
        setIsLoading(true);
        try {
            const data = await auditService.fetchAnomalyRules();
            setRules(data);
            // Initialize pending params and severity
            const initialParams: Record<string, any> = {};
            const initialSeverity: Record<string, AnomalyRule['severity']> = {};
            data.forEach(rule => {
                initialParams[rule.id] = { ...rule.params };
                initialSeverity[rule.id] = rule.severity;
            });
            setPendingParams(initialParams);
            setPendingSeverity(initialSeverity);
        } catch (error) {
            showToast('ルールの取得に失敗しました', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleToggleEnabled = async (rule: AnomalyRule) => {
        try {
            await auditService.updateAnomalyRule(rule.id, { enabled: !rule.enabled }, actor);
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
            showToast(`${rule.rule_key} を${!rule.enabled ? '有効' : '無効'}にしました`, 'success');
        } catch (error) {
            showToast('更新に失敗しました', 'error');
        }
    };

    const handleUpdateSeverity = (ruleId: string, severity: AnomalyRule['severity']) => {
        setPendingSeverity(prev => ({
            ...prev,
            [ruleId]: severity
        }));
    };

    const handleLocalParamChange = (ruleId: string, key: string, rawValue: string) => {
        let value: any = rawValue;

        // 数値項目の入力制御
        if (key === 'threshold' || key === 'window_minutes') {
            // 数字以外を除去
            const digits = rawValue.replace(/\D/g, '');

            if (digits === '' || digits === '0') {
                value = 0;
            } else {
                // 先頭の0を削除して数値化 (例: "09" -> 9)
                value = parseInt(digits, 10);
            }
        }

        setPendingParams(prev => ({
            ...prev,
            [ruleId]: {
                ...prev[ruleId],
                [key]: value
            }
        }));
    };

    const handleSaveParams = async (rule: AnomalyRule) => {
        try {
            const newParams = pendingParams[rule.id];
            const newSeverity = pendingSeverity[rule.id];
            let hasError = false;

            // バリデーション
            if (rule.rule_key === 'MULTIPLE_FAILED_LOGINS') {
                const threshold = newParams?.threshold;
                const window = newParams?.window_minutes;

                if (threshold < 1 || threshold > 99) {
                    showToast('失敗回数しきい値 で設定できるのは1~99回までです', 'error');
                    hasError = true;
                }
                if (window < 1 || window > 999) {
                    showToast('判定ウィンドウ (分)で設定できるのは1~999分までです', 'error');
                    hasError = true;
                }
            }

            if (hasError) return;

            await auditService.updateAnomalyRule(rule.id, {
                params: newParams,
                severity: newSeverity
            }, actor);

            setRules(prev => prev.map(r => r.id === rule.id ? {
                ...r,
                params: newParams,
                severity: newSeverity
            } : r));

            showToast('設定を保存しました', 'success');
        } catch (error) {
            showToast('保存に失敗しました', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-accent-electric"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <Shield className="text-accent-electric" size={28} />
                    <h1 className="text-3xl font-display font-bold text-ink">不正検知ルール設定</h1>
                </div>
                <p className="text-ink-light font-sans pl-10">
                    監査ログの不正検知アルゴリズムと重要度判定を管理します。
                </p>
            </div>

            <div className="grid gap-6">
                {rules.map(rule => (
                    <div key={rule.id} className="bg-white border-2 border-ink shadow-card rounded-xl overflow-hidden group">
                        {/* Header */}
                        <div className="px-6 py-4 bg-ink text-white flex justify-between items-center group-hover:bg-ink-light transition-colors">
                            <div className="flex items-center gap-3">
                                <Settings size={20} className="text-accent-electric" />
                                <span className="font-display font-bold tracking-wider">{rule.rule_key}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={clsx(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border-2",
                                    rule.enabled ? "bg-accent-electric text-ink border-white" : "bg-gray-500 text-white border-white"
                                )}>
                                    {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={rule.enabled}
                                        onChange={() => handleToggleEnabled(rule)}
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-electric border-2 border-white"></div>
                                </label>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8 grid md:grid-cols-2 gap-10 bg-paper">
                            {/* Info */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-ink-light uppercase tracking-widest mb-2 flex items-center gap-2">
                                        DESCRIPTION
                                        <div className="h-[1px] flex-1 bg-gray-200"></div>
                                    </h3>
                                    <p className="text-ink font-sans leading-relaxed">{rule.description}</p>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-ink-light uppercase tracking-widest mb-3 flex items-center gap-2">
                                        SEVERITY LEVEL
                                        <div className="h-[1px] flex-1 bg-gray-200"></div>
                                    </h3>
                                    <div className="flex gap-2">
                                        {(['low', 'medium', 'high', 'critical'] as const).map(sev => (
                                            <button
                                                key={sev}
                                                onClick={() => handleUpdateSeverity(rule.id, sev)}
                                                className={clsx(
                                                    "px-4 py-2 rounded font-display font-bold text-[10px] tracking-widest uppercase transition-all duration-300 border-2",
                                                    (pendingSeverity[rule.id] || rule.severity) === sev
                                                        ? {
                                                            'low': 'bg-blue-100 text-blue-700 border-blue-400 scale-105',
                                                            'medium': 'bg-yellow-100 text-yellow-700 border-yellow-400 scale-105',
                                                            'high': 'bg-orange-100 text-orange-700 border-orange-400 scale-105',
                                                            'critical': 'bg-red-100 text-red-700 border-red-400 scale-105 animate-pulse'
                                                        }[sev]
                                                        : "bg-white text-ink-light border-gray-200 hover:bg-gray-50 hover:border-ink opacity-60"
                                                )}
                                            >
                                                {sev}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-ink-light mt-3 italic">
                                        ※ この重要度はルール検知時の初期値として使用されます。
                                    </p>
                                </div>
                            </div>

                            {/* Parameters */}
                            <div className="bg-white border-2 border-ink-light rounded-lg p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Settings size={64} />
                                </div>
                                <h3 className="text-xs font-bold text-ink-light uppercase tracking-widest mb-6 flex items-center gap-2 bg-white relative z-10">
                                    PARAMETERS
                                    <div className="h-[1px] flex-1 bg-gray-200"></div>
                                </h3>

                                <div className="space-y-6 relative z-10">
                                    {rule.rule_key === 'AFTER_HOURS_ACCESS' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-ink-light uppercase mb-2">Start Time (JST)</label>
                                                <input
                                                    type="time"
                                                    value={pendingParams[rule.id]?.start || rule.params.start}
                                                    onChange={(e) => handleLocalParamChange(rule.id, 'start', e.target.value)}
                                                    className="w-full px-4 py-2 border-2 border-ink rounded font-display font-bold focus:ring-2 focus:ring-accent-electric outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-ink-light uppercase mb-2">End Time (JST)</label>
                                                <input
                                                    type="time"
                                                    value={pendingParams[rule.id]?.end || rule.params.end}
                                                    onChange={(e) => handleLocalParamChange(rule.id, 'end', e.target.value)}
                                                    className="w-full px-4 py-2 border-2 border-ink rounded font-display font-bold focus:ring-2 focus:ring-accent-electric outline-none transition-all"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <button
                                                    onClick={() => handleSaveParams(rule)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded font-bold text-xs hover:bg-zinc-800 transition-colors"
                                                >
                                                    <CheckCircle size={14} />
                                                    OK
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {rule.rule_key === 'MULTIPLE_FAILED_LOGINS' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-ink-light uppercase mb-2">失敗回数しきい値 (回)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={pendingParams[rule.id]?.threshold ?? rule.params.threshold ?? 5}
                                                    onChange={(e) => handleLocalParamChange(rule.id, 'threshold', e.target.value)}
                                                    className="w-full px-4 py-2 border-2 border-ink rounded font-display font-bold focus:ring-2 focus:ring-accent-electric outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-ink-light uppercase mb-2">判定ウィンドウ (分)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={pendingParams[rule.id]?.window_minutes ?? rule.params.window_minutes ?? 10}
                                                    onChange={(e) => handleLocalParamChange(rule.id, 'window_minutes', e.target.value)}
                                                    className="w-full px-4 py-2 border-2 border-ink rounded font-display font-bold focus:ring-2 focus:ring-accent-electric outline-none transition-all"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <button
                                                    onClick={() => handleSaveParams(rule)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded font-bold text-xs hover:bg-zinc-800 transition-colors"
                                                >
                                                    <CheckCircle size={14} />
                                                    OK
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Fallback for generic/complex parameters */}
                                    {rule.rule_key !== 'AFTER_HOURS_ACCESS' && rule.rule_key !== 'MULTIPLE_FAILED_LOGINS' && (
                                        <div className="bg-gray-50 p-4 border-2 border-dashed border-gray-200 rounded">
                                            <pre className="text-xs font-mono text-ink-light overflow-x-auto">
                                                {JSON.stringify(rule.params, null, 2)}
                                            </pre>
                                            <p className="text-[10px] mt-4 text-center italic">
                                                このルールの詳細編集は未対応です。
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 flex justify-center">
                                    <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-3">
                                        <AlertTriangle size={14} className="text-yellow-600" />
                                        <span className="text-[10px] text-yellow-800 font-bold">
                                            設定変更は即座にDBトリガーに反映されます。
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-ink text-white p-6 rounded-xl border-4 border-accent-electric shadow-[0_0_20px_rgba(42,243,246,0.3)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent-electric text-ink rounded-lg shadow-[0_0_10px_rgba(42,243,246,0.5)]">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h4 className="font-display font-bold tracking-wider">運用上の注意</h4>
                        <p className="text-xs text-gray-300 font-sans mt-1">ルールを無効にすると、重要度に基づいた通知も一切行われなくなります。</p>
                    </div>
                </div>
            </div>

            <ConfirmDialog />
        </div>
    );
}
