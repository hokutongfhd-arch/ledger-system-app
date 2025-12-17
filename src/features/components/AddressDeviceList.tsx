
import { useData } from '../context/DataContext';
import { Smartphone, Wifi, Tablet as TabletIcon, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AddressDeviceListProps {
    addressCode: string;
}

export const AddressDeviceList: React.FC<AddressDeviceListProps> = ({ addressCode }) => {
    const { iPhones, featurePhones, routers, tablets, employees } = useData();
    const navigate = useNavigate();

    if (!addressCode) return null;

    const handleDeviceClick = (path: string, id: string) => {
        navigate(`${path}?highlight=${id}`);
    };

    // Filter devices assigned to the target address
    const myIPhones = iPhones.filter(d => d.addressCode === addressCode);
    const myFeaturePhones = featurePhones.filter(d => d.addressCode === addressCode);
    const myRouters = routers.filter(d => d.addressCode === addressCode);
    const myTablets = tablets.filter(d => d.addressCode === addressCode);

    const hasNoDevices = myIPhones.length === 0 && myFeaturePhones.length === 0 && myRouters.length === 0 && myTablets.length === 0;

    if (hasNoDevices) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500 text-sm">紐づいているデバイスはありません。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-4">
                貸与デバイス一覧
            </h2>

            <div className="grid grid-cols-1 gap-6">
                {/* iPhone Section */}
                {myIPhones.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="border-b border-gray-100 p-4 flex items-center gap-3 bg-gray-50">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Smartphone size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">iPhone</h3>
                            <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{myIPhones.length}台</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {myIPhones.map(device => (
                                <div
                                    key={device.id}
                                    className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => handleDeviceClick('/devices/iphones', device.id)}
                                >
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">管理番号</p>
                                        <p className="font-medium text-gray-900">{device.managementNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">機種名</p>
                                        <p className="font-medium text-gray-900">{device.modelName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">使用者名</p>
                                        <p className="font-medium text-gray-900">
                                            {employees.find(e => e.code === device.employeeId)?.name || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">電話番号</p>
                                        <p className="font-medium text-gray-900">{device.phoneNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">キャリア</p>
                                        <p className="font-medium text-gray-900">{device.carrier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">貸与日</p>
                                        <p className="font-medium text-gray-900">{device.lendDate || '-'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Feature Phone Section */}
                {myFeaturePhones.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="border-b border-gray-100 p-4 flex items-center gap-3 bg-gray-50">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                <Phone size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">ガラホ</h3>
                            <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{myFeaturePhones.length}台</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {myFeaturePhones.map(device => (
                                <div
                                    key={device.id}
                                    className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => handleDeviceClick('/devices/feature-phones', device.id)}
                                >
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">管理番号</p>
                                        <p className="font-medium text-gray-900">{device.managementNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">機種名</p>
                                        <p className="font-medium text-gray-900">{device.modelName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">使用者名</p>
                                        <p className="font-medium text-gray-900">
                                            {employees.find(e => e.code === device.employeeId)?.name || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">電話番号</p>
                                        <p className="font-medium text-gray-900">{device.phoneNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">キャリア</p>
                                        <p className="font-medium text-gray-900">{device.carrier}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">貸与日</p>
                                        <p className="font-medium text-gray-900">{device.lendDate || '-'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Router Section */}
                {myRouters.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="border-b border-gray-100 p-4 flex items-center gap-3 bg-gray-50">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                <Wifi size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">モバイルルーター</h3>
                            <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{myRouters.length}台</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {myRouters.map(device => (
                                <div
                                    key={device.id}
                                    className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => handleDeviceClick('/devices/routers', device.id)}
                                >
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">端末CD</p>
                                        <p className="font-medium text-gray-900">{device.terminalCode}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">使用者名</p>
                                        <p className="font-medium text-gray-900">
                                            {employees.find(e => e.code === device.employeeCode)?.name || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">機種型番</p>
                                        <p className="font-medium text-gray-900">{device.modelNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">SIM電番</p>
                                        <p className="font-medium text-gray-900">{device.simNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">キャリア</p>
                                        <p className="font-medium text-gray-900">{device.carrier}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tablet Section */}
                {myTablets.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="border-b border-gray-100 p-4 flex items-center gap-3 bg-gray-50">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                <TabletIcon size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800">勤怠タブレット</h3>
                            <span className="ml-auto text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{myTablets.length}台</span>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {myTablets.map(device => (
                                <div
                                    key={device.id}
                                    className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => handleDeviceClick('/devices/tablets', device.id)}
                                >
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">端末CD</p>
                                        <p className="font-medium text-gray-900">{device.terminalCode}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">使用者名</p>
                                        <p className="font-medium text-gray-900">
                                            {employees.find(e => e.code === device.employeeCode)?.name || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">型番</p>
                                        <p className="font-medium text-gray-900">{device.modelNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">メーカー</p>
                                        <p className="font-medium text-gray-900">{device.maker}</p>
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
