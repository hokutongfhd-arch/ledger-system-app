import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { IPhone } from '../device.types';
import { Employee, Address } from '../../../lib/types';
import { Smartphone, MapPin, Calendar, FileText, User, Shield } from 'lucide-react';

interface IPhoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: IPhone | undefined;
    employees: Employee[];
    addresses: Address[];
}

export const IPhoneDetailModal: React.FC<IPhoneDetailModalProps> = ({
    isOpen,
    onClose,
    item,
    employees,
    addresses,
}) => {
    if (!item) return null;

    const employeeName = employees.find(e => e.code === item.employeeId)?.name || '-';
    const addressName = addresses.find(a => a.addressCode === item.addressCode)?.officeName || '-';

    // Status Badge Helper
    const getStatusColor = (status: string) => {
        switch (status) {
            case '貸出中': return 'bg-blue-100 text-blue-700 border-blue-200';
            case '返却済み': return 'bg-gray-100 text-gray-700 border-gray-200';
            case '貸出準備中': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-50 text-gray-500 border-gray-100';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="iPhone デバイス詳細">
            <div className="space-y-8 font-sans">

                {/* Header Section with Status */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.managementNumber}</h3>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(item.status)}`}>
                                {item.status}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            <Smartphone size={14} />
                            {item.modelName} / {item.carrier}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Device ID</p>
                        <p className="font-mono text-gray-600">{item.id.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: User & Location */}
                    <div className="space-y-6">
                        <SectionHeader icon={<User size={18} />} title="使用者情報 (User Info)" />

                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="社員名" value={employeeName} subValue={item.employeeId} />
                            <DetailRow label="設置場所" value={addressName} subValue={item.addressCode} icon={<MapPin size={14} className="text-gray-400" />} />
                        </div>

                        <SectionHeader icon={<Shield size={18} />} title="アカウント情報 (Account)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="SMARTアドレス帳ID" value={item.smartAddressId || '-'} />
                            <DetailRow label="SMARTアドレス帳PW" value={item.smartAddressPw || '••••••••'} isSensitive />
                        </div>
                    </div>

                    {/* Right Column: Contract & Dates */}
                    <div className="space-y-6">
                        <SectionHeader icon={<Calendar size={18} />} title="契約・日付 (Contract & Dates)" />

                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <DetailRow label="貸与日" value={item.lendDate} />
                                <DetailRow label="返却日" value={item.returnDate} />
                                <DetailRow label="受領提出日" value={item.receiptDate} />
                                <DetailRow label="契約年数" value={item.contractYears} />
                            </div>
                        </div>

                        <SectionHeader icon={<FileText size={18} />} title="備考 (Notes)" />
                        <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100 min-h-[100px]">
                            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                {item.notes || <span className="text-gray-400 italic">備考なし</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer / Meta */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>Phone Number: {item.phoneNumber}</span>
                    <span>Last Updated: -</span>
                </div>
            </div>
        </Modal>
    );
};

// Helper Components for Clean Layout
const SectionHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-2 text-indigo-900 border-b-2 border-indigo-50 pb-2 mb-2">
        <span className="text-indigo-500">{icon}</span>
        <h4 className="font-bold text-sm uppercase tracking-wide">{title}</h4>
    </div>
);

const DetailRow = ({ label, value, subValue, icon, isSensitive }: { label: string, value: string | undefined, subValue?: string, icon?: React.ReactNode, isSensitive?: boolean }) => (
    <div className="group">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">{label}</label>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <span className={`font-medium ${!value ? 'text-gray-300' : 'text-gray-800'} ${isSensitive ? 'font-mono' : ''}`}>
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
