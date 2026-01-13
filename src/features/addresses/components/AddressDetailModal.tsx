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

    const matchedArea = areas.find(a => a.areaName === item.area);
    const areaDisplay = item.area ? `${item.area}${matchedArea ? ` (${matchedArea.areaCode})` : ''}` : '-';

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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Basic & Contact */}
                    <div className="space-y-6">
                        <SectionHeader icon={<Building size={18} />} title="基本情報 (General Info)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="エリア" value={areaDisplay} />
                            <DetailRow label="No." value={item.no} />
                            <DetailRow label="事業所コード" value={item.addressCode} />
                            <DetailRow label="事業所名" value={item.officeName} />
                        </div>

                        <SectionHeader icon={<Phone size={18} />} title="連絡先 (Contact)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="TEL" value={formatPhoneNumber(item.tel)} />
                            <DetailRow label="FAX" value={formatPhoneNumber(item.fax)} />
                            <DetailRow label="補足" value={item.type} />
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-400 mb-1">所在地</p>
                                <p className="text-sm text-gray-700">〒{formatZipCode(item.zipCode)}</p>
                                <p className="text-sm text-gray-700 mt-0.5">{item.address}</p>
                            </div>
                        </div>

                        <SectionHeader icon={<FileText size={18} />} title="備考 (Notes)" />
                        <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100">
                            <DetailRow label="備考" value={item.notes} />
                        </div>
                    </div>

                    {/* Right Column: Details & Label */}
                    <div className="space-y-6">
                        <SectionHeader icon={<FileText size={18} />} title="詳細情報 (Details)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="事業部" value={item.division} />
                            <DetailRow label="エリア" value={areaDisplay} />
                            <DetailRow label="主担当" value={item.mainPerson} />
                            <DetailRow label="枝番" value={item.branchNumber} />
                            <DetailRow label="※" value={item.specialNote} />
                        </div>

                        <SectionHeader icon={<Tag size={18} />} title="宛名ラベル (Mailing Label)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="宛名" value={item.labelName} />
                            <DetailRow label="郵便番号" value={item.labelZip} />
                            <DetailRow label="住所" value={item.labelAddress} />
                        </div>

                        <SectionHeader icon={<FileText size={18} />} title="注意書き (Cautions)" />
                        <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100">
                            <DetailRow label="注意書き" value={item.attentionNote} />
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
