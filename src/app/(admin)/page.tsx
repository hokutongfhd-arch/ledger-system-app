'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../features/context/DataContext';
import { useAuth } from '../../features/context/AuthContext';
import { DonutChart } from '../../components/ui/DonutChart';
import { useSystemAlerts, type AlertSource } from '../../features/notifications/hooks/useSystemAlerts';
import { SegmentedDonutChart } from '../../components/ui/SegmentedDonutChart';
import { AlertCircle, ChevronRight } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();

    // Client-side redirection backup (Middleware handles main protection)
    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [user, router]);

    if (!user) return null;

    return <DashboardContent />;
}

function DashboardContent() {
    const { tablets, iPhones, featurePhones, routers } = useData();
    const alerts = useSystemAlerts();
    const router = useRouter();

    // 1. iPhone Logic
    const iPhoneTotal = iPhones.length;
    const iPhoneUsed = iPhones.filter(i => i.lendDate && !i.returnDate).length;

    // 2. Feature Phone Logic
    const featurePhoneTotal = featurePhones.length;
    const featurePhoneUsed = featurePhones.filter(f => f.lendDate && !f.returnDate).length;

    // 3. Router Logic
    const routerTotal = routers.length;
    const routerUsed = routers.filter(r => r.lendingHistory && !r.notes).length;

    // 4. Tablet Logic
    const tabletTotal = tablets.length;
    const tabletUsed = tablets.filter(t => t.status === 'in-use').length;

    // Alert Data Processing
    const alertCounts = alerts.reduce((acc, alert) => {
        acc[alert.source] = (acc[alert.source] || 0) + 1;
        return acc;
    }, {} as Record<AlertSource, number>);

    // Theme Colors
    const COLORS: Record<AlertSource, string> = {
        'iPhone': '#0EA5E9',
        'FeaturePhone': '#0D9488',
        'Tablet': '#4338CA',
        'Router': '#FF6B6B',
        'Employee': '#10B981',
        'Area': '#F59E0B',
        'Address': '#EC4899'
    };

    const sourceOptions: AlertSource[] = [
        'iPhone', 'FeaturePhone', 'Tablet', 'Router',
        'Employee', 'Area', 'Address'
    ];

    const alertSegments = sourceOptions
        .filter(source => alertCounts[source] > 0)
        .map(source => ({
            label: source,
            value: alertCounts[source],
            color: COLORS[source]
        }));

    const [sortBy, setSortBy] = useState<'source' | 'message'>('source');
    const [selectedSources, setSelectedSources] = useState<Set<AlertSource>>(new Set([
        'iPhone', 'FeaturePhone', 'Tablet', 'Router',
        'Employee', 'Area', 'Address'
    ]));

    const toggleSource = (source: AlertSource) => {
        const newSelected = new Set(selectedSources);
        if (newSelected.has(source)) {
            newSelected.delete(source);
        } else {
            newSelected.add(source);
        }
        setSelectedSources(newSelected);
    };

    const filteredAndSortedAlerts = useMemo(() => {
        let result = alerts.filter(a => selectedSources.has(a.source));

        result.sort((a, b) => {
            if (sortBy === 'source') {
                return sourceOptions.indexOf(a.source) - sourceOptions.indexOf(b.source);
            } else {
                return a.message.localeCompare(b.message);
            }
        });

        return result;
    }, [alerts, selectedSources, sortBy]);

    const handleAlertClick = (path: string) => {
        router.push(path);
    };

    const getAlertColor = (source: AlertSource) => COLORS[source] || '#94A3B8';

    return (
        <div className="space-y-12">
            <div className="space-y-8">
                <h1 className="text-3xl font-bold text-text-main font-display border-l-4 border-accent-electric pl-4">
                    デバイス使用率
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DonutChart
                        title="iPhone"
                        total={iPhoneTotal}
                        used={iPhoneUsed}
                        color="#0EA5E9"
                    />
                    <DonutChart
                        title="ガラホ"
                        total={featurePhoneTotal}
                        used={featurePhoneUsed}
                        color="#0D9488"
                    />
                    <DonutChart
                        title="モバイルルーター"
                        total={routerTotal}
                        used={routerUsed}
                        color="#FF6B6B"
                    />
                    <DonutChart
                        title="勤怠タブレット"
                        total={tabletTotal}
                        used={tabletUsed}
                        color="#4338CA"
                    />
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-text-main flex items-center gap-3">
                    <AlertCircle className="text-accent-coral" />
                    システムアラート
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 flex items-center justify-center p-8 bg-background-paper border border-border shadow-card rounded-2xl">
                        <SegmentedDonutChart
                            title="アラート総数"
                            segments={alertSegments}
                            total={alerts.length}
                        />
                    </div>

                    <div className="lg:col-span-2 bg-background-paper border border-border shadow-card rounded-2xl p-0 overflow-hidden flex flex-col max-h-[600px]">
                        <div className="p-4 border-b border-border bg-background-subtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-text-main whitespace-nowrap">アラート一覧 ({filteredAndSortedAlerts.length}件)</h3>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'source' | 'message')}
                                    className="bg-white border border-border rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-accent-electric"
                                >
                                    <option value="source">ソース順</option>
                                    <option value="message">内容順</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-4 gap-x-4 gap-y-2 justify-end w-fit ml-auto">
                                <label className="flex items-center gap-1.5 cursor-pointer hover:bg-black/5 px-2 py-0.5 rounded transition-colors text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedSources.size === sourceOptions.length}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedSources(new Set(sourceOptions));
                                            } else {
                                                setSelectedSources(new Set());
                                            }
                                        }}
                                        className="rounded border-gray-300 text-accent-electric focus:ring-accent-electric"
                                    />
                                    <span className="font-medium text-xs text-text-main">
                                        全て
                                    </span>
                                </label>
                                {sourceOptions.map(source => (
                                    <label key={source} className="flex items-center gap-1.5 cursor-pointer hover:bg-black/5 px-2 py-0.5 rounded transition-colors text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedSources.has(source)}
                                            onChange={() => toggleSource(source)}
                                            className="rounded border-gray-300 text-accent-electric focus:ring-accent-electric"
                                            style={{ accentColor: COLORS[source] }}
                                        />
                                        <span style={{ color: COLORS[source] }} className="font-medium text-xs">
                                            {source}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-2">
                            {filteredAndSortedAlerts.length === 0 ? (
                                <div className="text-center py-10 text-text-secondary">
                                    表示するアラートはありません。
                                </div>
                            ) : (
                                filteredAndSortedAlerts.map((alert, index) => (
                                    <button
                                        key={`${alert.id}-${index}`}
                                        onClick={() => handleAlertClick(alert.path)}
                                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-background-subtle border border-transparent hover:border-border transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-2 h-12 rounded-full"
                                                style={{ backgroundColor: getAlertColor(alert.source) }}
                                            ></div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className="text-xs font-bold px-2 py-0.5 rounded text-white"
                                                        style={{ backgroundColor: getAlertColor(alert.source) }}
                                                    >
                                                        {alert.source}
                                                    </span>
                                                    <span className="text-xs text-text-secondary">{alert.type.replace(/_/g, ' ').toUpperCase()}</span>
                                                </div>
                                                <p className="text-sm font-medium text-text-main">{alert.message}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-text-muted group-hover:text-text-main transition-colors" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
