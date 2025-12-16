
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Smartphone, Wifi, Tablet as TabletIcon, Phone } from 'lucide-react';

interface UserDeviceListProps {
    targetCode?: string;
    targetName?: string;
}

export const UserDeviceList: React.FC<UserDeviceListProps> = ({ targetCode, targetName }) => {
    const { user } = useAuth();
    const { iPhones, featurePhones, routers, tablets } = useData();

    // Determine target user to display
    // If props are provided, use them. Otherwise, use logged-in user.
    const codeToUse = targetCode || user?.code;
    const nameToUse = targetName || user?.name;

    if (!codeToUse && !targetCode) return null; // If no target and no logged-in user, show nothing

    // Filter devices assigned to the target user
    const myIPhones = iPhones.filter(d => d.employeeId === codeToUse);
    const myFeaturePhones = featurePhones.filter(d => d.employeeId === codeToUse);
    const myRouters = routers.filter(d => (d.employeeCode && d.employeeCode === codeToUse) || d.actualLender === codeToUse || d.actualLender === nameToUse);
    const myTablets = tablets.filter(d => d.employeeCode === codeToUse);

    const hasNoDevices = myIPhones.length === 0 && myFeaturePhones.length === 0 && myRouters.length === 0 && myTablets.length === 0;

    if (hasNoDevices) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-background-paper rounded-2xl border border-border shadow-card h-full min-h-[400px]">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <Smartphone size={48} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-2">貸与デバイスはありません</h3>
                <p className="text-text-secondary text-sm">割り当てられているデバイスは現在ありません。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-text-main font-display border-l-4 border-accent-electric pl-4">
                貸与デバイス一覧
            </h2>

            <div className="grid grid-cols-1 gap-6">
                {/* iPhone Section */}
                {myIPhones.length > 0 && (
                    <div className="bg-background-paper border border-border rounded-2xl overflow-hidden shadow-card group">
                        <div className="border-b border-gray-100 p-6 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Smartphone size={20} />
                            </div>
                            <h3 className="font-bold text-text-main">iPhone</h3>
                            <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{myIPhones.length}台</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {myIPhones.map(device => (
                                <div key={device.id} className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">管理番号</p>
                                        <p className="font-medium text-text-main">{device.managementNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">機種名</p>
                                        <p className="font-medium text-text-main">{device.modelName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">電話番号</p>
                                        <p className="font-medium text-text-main">{device.phoneNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">キャリア</p>
                                        <p className="font-medium text-text-main">{device.carrier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">貸与日</p>
                                        <p className="font-medium text-text-main">{device.lendDate || '-'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Feature Phone Section */}
                {myFeaturePhones.length > 0 && (
                    <div className="bg-background-paper border border-border rounded-2xl overflow-hidden shadow-card group">
                        <div className="border-b border-gray-100 p-6 flex items-center gap-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <Phone size={20} />
                            </div>
                            <h3 className="font-bold text-text-main">ガラホ</h3>
                            <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{myFeaturePhones.length}台</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {myFeaturePhones.map(device => (
                                <div key={device.id} className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">管理番号</p>
                                        <p className="font-medium text-text-main">{device.managementNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">機種名</p>
                                        <p className="font-medium text-text-main">{device.modelName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">電話番号</p>
                                        <p className="font-medium text-text-main">{device.phoneNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">キャリア</p>
                                        <p className="font-medium text-text-main">{device.carrier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">貸与日</p>
                                        <p className="font-medium text-text-main">{device.lendDate || '-'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Router Section */}
                {myRouters.length > 0 && (
                    <div className="bg-background-paper border border-border rounded-2xl overflow-hidden shadow-card group">
                        <div className="border-b border-gray-100 p-6 flex items-center gap-3">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <Wifi size={20} />
                            </div>
                            <h3 className="font-bold text-text-main">モバイルルーター</h3>
                            <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{myRouters.length}台</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {myRouters.map(device => (
                                <div key={device.id} className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">端末CD</p>
                                        <p className="font-medium text-text-main">{device.terminalCode}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">機種型番</p>
                                        <p className="font-medium text-text-main">{device.modelNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">SIM電番</p>
                                        <p className="font-medium text-text-main">{device.simNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">キャリア</p>
                                        <p className="font-medium text-text-main">{device.carrier}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tablet Section */}
                {myTablets.length > 0 && (
                    <div className="bg-background-paper border border-border rounded-2xl overflow-hidden shadow-card group">
                        <div className="border-b border-gray-100 p-6 flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                <TabletIcon size={20} />
                            </div>
                            <h3 className="font-bold text-text-main">勤怠タブレット</h3>
                            <span className="ml-auto text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{myTablets.length}台</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {myTablets.map(device => (
                                <div key={device.id} className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">端末CD</p>
                                        <p className="font-medium text-text-main">{device.terminalCode}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">型番</p>
                                        <p className="font-medium text-text-main">{device.modelNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-text-secondary mb-1">メーカー</p>
                                        <p className="font-medium text-text-main">{device.maker}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
