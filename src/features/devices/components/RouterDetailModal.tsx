import { DetailRow } from '../../../components/ui/DetailView';
import { SectionHeader } from '../../../components/ui/Section';
import { Modal } from '../../../components/ui/Modal';
import { getRouterHistoryAction } from '../../../app/actions/device';
import { Router, RouterUsageHistory } from '../device.types';
import { Employee, Address } from '../../../lib/types';
import { Wifi, MapPin, Calendar, FileText, User, Server, DollarSign, History, Phone, ArrowLeft } from 'lucide-react';
import { formatPhoneNumber } from '../../../lib/utils/phoneUtils';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { useState, useEffect } from 'react';

interface RouterDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Router | undefined;
    employees: Employee[];
    addresses: Address[];
}

export const RouterDetailModal: React.FC<RouterDetailModalProps> = ({
    isOpen,
    onClose,
    item,
    employees,
    addresses,
}) => {
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<RouterUsageHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowHistory(false);
            setHistory([]);
        }
    }, [isOpen]);

    const handleFetchHistory = async () => {
        if (!item) return;
        setLoadingHistory(true);
        try {
            const data = await getRouterHistoryAction(item.id);
            setHistory(data);
            setShowHistory(true);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!item) return null;

    const employeeName = employees.find(e => e.code === item.employeeCode)?.name || '-';
    // Helper to resolve employee name in history
    const getEmployeeName = (code: string) => employees.find(e => e.code === code)?.name || code;

    // Logic for Address vs OfficeCode display could be unified, typically finding by addressCode
    const addressName = addresses.find(a => a.addressCode === item.addressCode)?.officeName || '-';


    // Status Badge Helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'in-use': return 'bg-green-100 text-green-700 border-green-200';
            case 'backup': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'available': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'broken': return 'bg-red-100 text-red-700 border-red-200';
            case 'repairing': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'discarded': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-50 text-gray-500 border-gray-100';
        }
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            'in-use': '使用中',
            'backup': '予備機',
            'available': '在庫',
            'broken': '故障',
            'repairing': '修理中',
            'discarded': '廃棄',
        };
        return map[status] || status;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={showHistory ? "ルーター 使用履歴" : "ルーター デバイス詳細"}>
            <div className="space-y-8 font-sans">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.terminalCode}</h3>
                        </div>
                        <div className="text-gray-500 text-sm space-y-1">
                            <div className="flex items-center gap-1">
                                <Wifi size={14} />
                                {item.modelNumber} / {item.carrier}
                            </div>
                            <div className="text-blue-600 font-bold text-lg flex items-center gap-1 mt-1">
                                <Phone size={16} />
                                {formatPhoneNumber(item.simNumber || '')}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Data Cap</p>
                            <p className="font-mono text-gray-600 font-bold">{item.dataCapacity || '-'}</p>
                        </div>

                        {!showHistory ? (
                            <button
                                onClick={handleFetchHistory}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <History size={16} />
                                旧使用者を確認
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowHistory(false)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <ArrowLeft size={16} />
                                詳細に戻る
                            </button>
                        )}
                    </div>
                </div>

                {showHistory ? (
                    <div className="space-y-4">
                        {loadingHistory ? (
                            <div className="text-center py-8 text-gray-500">読み込み中...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                履歴はありません
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用者</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">設置場所</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">貸与期間</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {history.map((record) => (
                                            <tr key={record.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{getEmployeeName(record.employeeCode)}</div>
                                                    <div className="text-xs text-gray-500">{record.employeeCode}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.officeCode}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {addresses.find(a => a.addressCode === record.officeCode)?.officeName || ''}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {/* Router doesn't have reliable start date in DB, so it might be empty */}
                                                    {record.startDate || '?'} 〜 {record.endDate || '?'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8 font-sans">
                        {/* Section 1: Basic Info */}
                        <div>
                            <SectionHeader icon={<Wifi size={18} />} title="基本情報" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailRow label="端末CD" value={item.terminalCode} icon={<Wifi size={14} className="text-gray-400" />} />
                                    <DetailRow label="SIM電番" value={formatPhoneNumber(item.simNumber || '')} icon={<Phone size={14} className="text-gray-400" />} />

                                    <DetailRow label="機種型番" value={item.modelNumber} />
                                    <DetailRow label="通信キャリア" value={item.carrier} />

                                    <DetailRow label="通信容量" value={item.dataCapacity} />
                                    <DetailRow label="契約状況" value={item.contractStatus} />

                                    <DetailRow label="契約年数" value={normalizeContractYear(item.contractYears || '')} />
                                    <div className="group">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">状況</label>
                                        <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusColor(item.status)}`}>
                                            {getStatusLabel(item.status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: User Info */}
                        <div>
                            <SectionHeader icon={<User size={18} />} title="使用者情報" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailRow label="社員名" value={employeeName} subValue={item.employeeCode} icon={<User size={14} className="text-gray-400" />} />
                                    <DetailRow label="事業所" value={addressName} subValue={item.addressCode} icon={<MapPin size={14} className="text-gray-400" />} />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Network Info */}
                        <div>
                            <SectionHeader icon={<Server size={18} />} title="ネットワーク情報" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailRow label="IPアドレス" value={item.ipAddress} isSensitive />
                                    <DetailRow label="サブネットマスク" value={item.subnetMask} isSensitive />
                                    <DetailRow label="開始IP" value={item.startIp} isSensitive />
                                    <DetailRow label="終了IP" value={item.endIp} isSensitive />
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Cost & Management Info */}
                        <div>
                            <SectionHeader icon={<DollarSign size={18} />} title="費用・管理情報" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailRow label="請求元" value={item.biller} />
                                    <DetailRow label="負担先" value={item.costBearer} />
                                    <DetailRow label="費用" value={item.cost ? `¥${item.cost.toLocaleString()}` : '-'} isSensitive />
                                    <DetailRow label="費用振替" value={item.costTransfer} />
                                </div>
                            </div>
                        </div>

                        {/* Section 5: Others */}
                        <div>
                            <SectionHeader icon={<FileText size={18} />} title="その他" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">貸与履歴</label>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.lendingHistory || '-'}</p>
                                    </div>
                                    <div className="border-t border-gray-200 pt-4">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">備考 (返却日含む)</label>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                            {item.notes || <span className="text-gray-400 italic">備考なし</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



            </div>
        </Modal>
    );
};


