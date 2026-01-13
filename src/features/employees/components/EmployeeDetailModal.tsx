import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Employee, Area, Address } from '../../../lib/types';
import { User, Briefcase, MapPin, Shield, Smartphone } from 'lucide-react';
import { DetailRow } from '../../../components/ui/DetailView';
import { SectionHeader } from '../../../components/ui/Section';
import { UserDeviceList } from './UserDeviceList';

interface EmployeeDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Employee | undefined;
    areas: Area[];
    addresses: Address[];
    isAdmin: boolean;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
    isOpen,
    onClose,
    item,
    areas,
    addresses,
    isAdmin,
}) => {
    if (!item) return null;

    const areaName = areas.find(a => a.areaCode === item.areaCode)?.areaName || '-';
    const addressName = addresses.find(a => a.addressCode === item.addressCode)?.officeName || '-';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="社員 詳細">
            <div className="space-y-8 font-sans">
                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.name}</h3>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${item.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {item.role === 'admin' ? '管理者' : 'ユーザー'}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            {item.nameKana} / {item.code}
                        </p>
                    </div>

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Personal & Location */}
                    <div className="space-y-6">
                        <SectionHeader icon={<User size={18} />} title="基本情報 (Personal Profile)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="社員コード" value={item.code} />
                            <DetailRow label="性別" value={item.gender} />
                            <DetailRow label="生年月日" value={item.birthDate} subValue={`${item.age}歳`} />
                        </div>

                        <SectionHeader icon={<MapPin size={18} />} title="所属情報 (Location)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="エリア" value={areaName} subValue={item.areaCode} />
                            <DetailRow label="事業所" value={addressName} subValue={item.addressCode} />
                        </div>
                    </div>

                    {/* Right Column: Work & System */}
                    <div className="space-y-6">
                        <SectionHeader icon={<Briefcase size={18} />} title="勤務情報 (Employment)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <DetailRow label="入社日" value={item.joinDate} />
                                <DetailRow label="勤続" value={`${item.yearsOfService}年`} subValue={`${item.monthsHasuu}ヶ月`} />
                            </div>
                        </div>

                        <SectionHeader icon={<Shield size={18} />} title="システム情報 (System)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="権限" value={item.role === 'admin' ? '管理者' : 'ユーザー'} />
                            {isAdmin && (
                                <DetailRow label="パスワード" value={item.password || '••••••••'} isSensitive />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer: Devices */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <SectionHeader icon={<Smartphone size={18} />} title="貸与デバイス (Assigned Devices)" />
                    <div className="mt-4">
                        <UserDeviceList targetCode={item.code} targetName={item.name} />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
