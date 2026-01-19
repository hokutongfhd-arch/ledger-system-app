'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { AlertCircle, ChevronRight } from 'lucide-react';

import { useData } from '../../../features/context/DataContext';
import { useAuth } from '../../../features/context/AuthContext';
import { useSystemAlerts } from '../../../features/notifications/hooks/useSystemAlerts';
import { UserProfileCard } from '../../../features/employees/components/UserProfileCard';
import { UserDeviceList } from '../../../features/employees/components/UserDeviceList';
import { MemoPad } from '../../../features/dashboard/components/MemoPad';

export default function UserDashboardPage() {
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) router.push('/login');
    }, [user, router]);

    if (!user) return null;

    return (
        <UserDashboardContent />
    );
}

function UserDashboardContent() {
    const { user } = useAuth();
    const { iPhones, featurePhones, tablets, routers } = useData();
    const alerts = useSystemAlerts();
    const router = useRouter();

    useEffect(() => {
        toast.success('マイページへようこそ', { id: 'welcome-toast' });
    }, []);

    // Filter alerts for the current user (Employee record)
    const myAlerts = useMemo(() => {
        if (!user) return [];

        // 1. Identify devices assigned to this user
        const userDeviceIds = new Set<string>();
        iPhones.forEach(d => { if (d.employeeId === user.code) userDeviceIds.add(d.id); });
        featurePhones.forEach(d => { if (d.employeeId === user.code) userDeviceIds.add(d.id); });
        tablets.forEach(d => { if (d.employeeCode === user.code) userDeviceIds.add(d.id); });
        routers.forEach(d => { if (d.employeeCode === user.code) userDeviceIds.add(d.id); });

        return alerts.filter(alert => {
            // Case A: Alert is directly for the employee record
            // CAUTION: alert.recordId for Employee alerts is the database ID (uuid), not the employee code.
            // But we have user.id (uuid) from AuthContext.
            if (alert.source === 'Employee' && alert.recordId === user.id) return true;

            // Case B: Alert is for a device assigned to the employee
            if (userDeviceIds.has(alert.recordId)) return true;

            return false;
        });
    }, [user, alerts, iPhones, featurePhones, tablets, routers]);

    const handleAlertClick = (path: string) => {
        router.push(path);
    };

    // Helper to map AlertSource to Japanese Label
    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'iPhone': return 'iPhone';
            case 'FeaturePhone': return 'ガラホ';
            case 'Tablet': return 'タブレット';
            case 'Router': return 'ルーター';
            case 'Employee': return '社員';
            case 'Area': return 'エリア';
            case 'Address': return '事業所';
            default: return source;
        }
    };

    return (
        <div className="font-sans text-pulsar-text-main">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pulsar-text-main to-pulsar-text-secondary">
                        マイページ
                    </h1>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Column: User Profile */}
                <div className="w-full lg:w-1/3 max-w-sm mx-auto lg:mx-0">
                    <h2 className="text-2xl font-bold text-text-main font-display border-l-4 border-accent-electric pl-4 mb-6">
                        ユーザー情報確認
                    </h2>
                    <UserProfileCard />
                </div>

                {/* Right Column: Assigned Devices */}
                <div className="w-full lg:w-2/3">
                    <h2 className="text-2xl font-bold text-text-main font-display border-l-4 border-accent-electric pl-4 mb-6">
                        貸与デバイス一覧
                    </h2>
                    <UserDeviceList />
                </div>
            </div>

            {/* Alert Section */}
            <div className="space-y-6 mt-12">
                <h2 className="text-2xl font-bold text-text-main font-display border-l-4 border-accent-coral pl-4 flex items-center gap-3">
                    システムアラート
                </h2>

                <div className="card bg-background-paper border border-border shadow-card rounded-2xl p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border bg-background-subtle">
                        <h3 className="font-bold text-text-main">アラート一覧 ({myAlerts.length}件)</h3>
                    </div>
                    <div className="p-2 space-y-2">
                        {myAlerts.length === 0 ? (
                            <div className="text-center py-10 text-text-secondary">
                                現在アラートはありません。システムは正常です。
                            </div>
                        ) : (
                            myAlerts.map(alert => (
                                <button
                                    key={alert.id}
                                    onClick={() => handleAlertClick(alert.path)}
                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-background-subtle border border-transparent hover:border-border transition-all group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="text-accent-coral">
                                            <AlertCircle size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-accent-coral">
                                                    要確認
                                                </span>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded text-white bg-slate-500">
                                                    {getSourceLabel(alert.source)}
                                                </span>
                                                <span className="text-xs text-text-secondary">登録データ不整合</span>
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
            {/* Memo Section */}
            <div className="space-y-6 mt-12 mb-12">
                <h2 className="text-2xl font-bold text-text-main font-display border-l-4 border-secondary-ocean pl-4 flex items-center gap-3">
                    マイメモ
                </h2>
                <div className="h-full">
                    {user && <MemoPad employeeCode={user.code} />}
                </div>
            </div>
        </div >
    );
}
