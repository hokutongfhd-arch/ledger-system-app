import { DetailRow } from '../../../components/ui/DetailView';
import { SectionHeader } from '../../../components/ui/Section';
import { Modal } from '../../../components/ui/Modal';
import { Router } from '../device.types';
import { Employee, Address } from '../../../lib/types';
import { Wifi, MapPin, Calendar, FileText, User, Server, DollarSign, History, Phone } from 'lucide-react';
import { formatPhoneNumber } from '../../../lib/utils/phoneUtils';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';

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
    if (!item) return null;

    const employeeName = employees.find(e => e.code === item.employeeCode)?.name || '-';
    // Logic for Address vs OfficeCode display could be unified, typically finding by addressCode
    const addressName = addresses.find(a => a.addressCode === item.addressCode)?.officeName || '-';


    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ルーター デバイス詳細">
            <div className="space-y-8 font-sans">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 tracking-tight mb-1">{item.terminalCode}</h3>
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
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Data Cap</p>
                        <p className="font-mono text-gray-600 font-bold">{item.dataCapacity || '-'}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: User & Location */}
                    <div className="space-y-6">
                        <SectionHeader icon={<User size={18} />} title="使用者・場所 (User & Location)" />

                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="社員名" value={employeeName} subValue={item.employeeCode} />
                            <DetailRow label="設置場所" value={addressName} subValue={item.addressCode} icon={<MapPin size={14} className="text-gray-400" />} />
                            <DetailRow label="実貸与先" value={item.actualLenderName} subValue={item.actualLender} />
                            <DetailRow label="会社" value={item.company} />
                        </div>

                        <SectionHeader icon={<Server size={18} />} title="ネットワーク情報 (Network)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <DetailRow label="IP Address" value={item.ipAddress} isSensitive />
                                <DetailRow label="Subnet" value={item.subnetMask} isSensitive />
                                <DetailRow label="Start IP" value={item.startIp} isSensitive />
                                <DetailRow label="End IP" value={item.endIp} isSensitive />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Contract & Cost */}
                    <div className="space-y-6">
                        <SectionHeader icon={<DollarSign size={18} />} title="契約・費用 (Contract & Cost)" />

                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <DetailRow label="契約年数" value={normalizeContractYear(item.contractStatus || '')} />
                                <DetailRow label="請求元" value={item.biller} />
                                <DetailRow label="負担先" value={item.costBearer} />
                                <DetailRow label="費用" value={item.cost ? `¥${item.cost.toLocaleString()}` : '-'} isSensitive />
                                <DetailRow label="費用振替" value={item.costTransfer} />
                            </div>
                        </div>

                        <SectionHeader icon={<History size={18} />} title="履歴・備考 (History & Notes)" />
                        <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100 min-h-[100px]">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1 block">貸与履歴</label>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.lendingHistory || '-'}</p>
                                </div>
                                <div className="border-t border-yellow-200 pt-2">
                                    <label className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1 block">備考</label>
                                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                        {item.notes || <span className="text-gray-400 italic">備考なし</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>No: {item.no}</span>
                    <span>Device ID: {item.id}</span>
                </div>
            </div>
        </Modal>
    );
};


