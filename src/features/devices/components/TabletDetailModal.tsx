import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { Tablet, DeviceStatus } from '../device.types';
import { Employee, Address } from '../../../lib/types';
import { Tablet as TabletIcon, MapPin, FileText, User, Building, History } from 'lucide-react';

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
    if (!item) return null;

    const employeeName = employees.find(e => e.code === item.employeeCode)?.name || '-';
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
        <Modal isOpen={isOpen} onClose={onClose} title="タブレット デバイス詳細">
            <div className="space-y-8 font-sans">

                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.terminalCode}</h3>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            <TabletIcon size={14} />
                            {item.maker} / {item.modelNumber}
                        </p>
                    </div>
                </div>

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

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>Device ID: {item.id}</span>
                </div>
            </div>
        </Modal>
    );
};

// Helper Components
const SectionHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-2 text-indigo-900 border-b-2 border-indigo-50 pb-2 mb-2">
        <span className="text-indigo-500">{icon}</span>
        <h4 className="font-bold text-sm uppercase tracking-wide">{title}</h4>
    </div>
);

const DetailRow = ({ label, value, subValue, icon }: { label: string, value: string | undefined, subValue?: string, icon?: React.ReactNode }) => (
    <div className="group">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">{label}</label>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <span className={`font-medium ${!value ? 'text-gray-300' : 'text-gray-800'}`}>
                    {value || '-'}
                </span>
                {subValue && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    </div>
);
