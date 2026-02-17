import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Address, Area } from '../../../lib/types';
import { Building, Phone, MapPin, Tag, FileText, Router } from 'lucide-react';
import { DetailRow } from '../../../components/ui/DetailView';
import { SectionHeader } from '../../../components/ui/Section';
import { AddressDeviceList } from './AddressDeviceList';
import { formatPhoneNumber } from '../../../lib/utils/phoneUtils';
import { formatZipCode } from '../../../lib/utils/zipCodeUtils';

interface AddressDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Address | undefined;
    areas: Area[];
}

export const AddressDetailModal: React.FC<AddressDetailModalProps> = ({
    isOpen,
    onClose,
    item,
    areas,
}) => {
    if (!item) return null;

    const matchedArea = areas.find(a => a.areaName === item.area || a.areaCode === item.area);
    const areaDisplay = matchedArea ? `${matchedArea.areaCode} (${matchedArea.areaName})` : (item.area || '-');

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="事業所 詳細">
            <div className="space-y-8 font-sans">
                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.officeName}</h3>
                        </div>
                        <p className="text-gray-600 text-sm font-medium mb-1">
                            〒{formatZipCode(item.zipCode)}
                        </p>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            <MapPin size={14} />
                            {item.address}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Address Code</p>
                        <p className="font-mono text-gray-600 font-bold">{item.addressCode}</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Section 1: Basic Info */}
                    <div>
                        <SectionHeader icon={<Building size={18} />} title="基本情報" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="事業所コード" value={item.addressCode} />
                                <DetailRow label="事業所名" value={item.officeName} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="エリアコード" value={areaDisplay} />
                                <DetailRow label="No." value={item.no} />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Contact Info */}
                    <div>
                        <SectionHeader icon={<Phone size={18} />} title="連絡先情報" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="〒" value={formatZipCode(item.zipCode)} />
                                <DetailRow label="住所" value={item.address} icon={<MapPin size={14} className="text-gray-400" />} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="TEL" value={formatPhoneNumber(item.tel)} />
                                <DetailRow label="FAX" value={formatPhoneNumber(item.fax)} />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Additional Info */}
                    <div>
                        <SectionHeader icon={<FileText size={18} />} title="詳細情報" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="事業部" value={item.division} />
                                <DetailRow label="経理コード" value={item.accountingCode} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="エリアコード(確認用)" value={areaDisplay} />
                                <DetailRow label="主担当" value={item.mainPerson} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="枝番" value={item.branchNumber} />
                                <DetailRow label="※" value={item.specialNote} />
                            </div>
                            <div className="pt-4 border-t border-gray-200">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">備考</label>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {item.notes || <span className="text-gray-400 italic">備考なし</span>}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Label Info */}
                    <div>
                        <SectionHeader icon={<Tag size={18} />} title="宛名ラベル情報" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow label="宛名ラベル用" value={item.labelName} />
                                <DetailRow label="宛名ラベル用〒" value={formatZipCode(item.labelZip)} />
                            </div>
                            <DetailRow label="宛名ラベル用住所" value={item.labelAddress} />
                            <div className="pt-4 border-t border-gray-200">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">注意書き</label>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {item.attentionNote || <span className="text-gray-400 italic">注意書きなし</span>}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer: Devices */}
                <div className="mt-8 pt-4 border-t border-gray-100">
                    <SectionHeader icon={<Router size={18} />} title="設置デバイス (Installed Devices)" />
                    <div className="mt-4">
                        <AddressDeviceList addressCode={item.addressCode} />
                    </div>
                </div>
            </div>
        </Modal>
    );
};
