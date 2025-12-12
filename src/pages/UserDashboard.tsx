import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSystemAlerts } from '../hooks/useSystemAlerts';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { UserProfileCard } from '../components/ui/UserProfileCard';
import { UserDeviceList } from '../components/ui/UserDeviceList';

export const UserDashboard = () => {
    const { user } = useAuth();
    const alerts = useSystemAlerts();
    const navigate = useNavigate();

    // Filter alerts for the current user (Employee record)
    // We strictly check for alerts linked to the user's ID
    const myAlerts = user ? alerts.filter(a => a.recordId === user.id && (a.type === 'unregistered_area' || a.type === 'unregistered_address')) : [];

    const handleAlertClick = (path: string) => {
        navigate(path);
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
                    <UserDeviceList />
                </div>
            </div>

            {/* Alert Section */}
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
        </div >
    );
};
