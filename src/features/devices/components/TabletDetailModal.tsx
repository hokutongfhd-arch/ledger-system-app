import { DetailRow } from '../../../components/ui/DetailView';
import { SectionHeader } from '../../../components/ui/Section';
import { Modal } from '../../../components/ui/Modal';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { getTabletHistoryAction } from '../../../app/actions/device';
import { Tablet, TabletUsageHistory, DeviceStatus } from '../device.types';
import { Employee, Address } from '../../../lib/types';
import { Tablet as TabletIcon, MapPin, FileText, User, Building, History, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TabletDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Tablet | undefined;
    employees: Employee[];
    addresses: Address[];
}

export const TabletDetailModal: React.FC<TabletDetailModalProps> = ({
    isOpen,
    onClose,
    item,
    employees,
    addresses,
}) => {
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<TabletUsageHistory[]>([]);
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
            const data = await getTabletHistoryAction(item.id);
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
    const getStatusColor = (status: DeviceStatus) => {
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

    const getStatusLabel = (status: DeviceStatus) => {
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
        <Modal isOpen={isOpen} onClose={onClose} title={showHistory ? "タブレット 使用履歴" : "タブレット デバイス詳細"}>
            <div className="space-y-8 font-sans">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.terminalCode}</h3>
                            {!showHistory && (
                                <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(item.status)}`}>
                                    {getStatusLabel(item.status)}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            <TabletIcon size={14} />
                            {item.maker} / {item.modelNumber}
                        </p>
                    </div>
                    <div>
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
                                                    {/* Tablet doesn't have reliable start date in DB, so it might be empty */}
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: User & Location */}
                        <div className="space-y-6">
                            <SectionHeader icon={<User size={18} />} title="使用者情報 (User Info)" />

                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <DetailRow label="社員名" value={employeeName} subValue={item.employeeCode} />
                                <DetailRow label="設置場所" value={addressName} subValue={item.addressCode} icon={<MapPin size={14} className="text-gray-400" />} />
                            </div>

                            <SectionHeader icon={<Building size={18} />} title="管理情報 (Management)" />
                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <DetailRow label="事業所コード" value={item.officeCode} />
                                <DetailRow label="負担先" value={item.costBearer} />
                                <DetailRow label="契約年数" value={normalizeContractYear(item.contractYears || '')} />
                            </div>
                        </div>

                        {/* Right Column: History & Notes */}
                        <div className="space-y-6">
                            <SectionHeader icon={<History size={18} />} title="履歴・備考 (History & Notes)" />

                            <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                                <div className="group">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">過去貸与履歴</label>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.history || '-'}</p>
                                </div>
                            </div>

                            <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100 min-h-[100px]">
                                <div className="flex gap-2 items-center mb-2">
                                    <FileText size={14} className="text-yellow-600" />
                                    <span className="text-xs font-bold text-yellow-700 uppercase">備考</span>
                                </div>
                                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                    {item.notes || <span className="text-gray-400 italic">備考なし</span>}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>Device ID: {item.id}</span>
                </div>
            </div>
        </Modal>
    );
};


