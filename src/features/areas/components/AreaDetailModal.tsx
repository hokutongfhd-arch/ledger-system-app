import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Area } from '../../../lib/types';
import { MapPin } from 'lucide-react';
import { SectionHeader, DetailRow } from '../../../components/ui/DetailView';

interface AreaDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Area | undefined;
}

export const AreaDetailModal: React.FC<AreaDetailModalProps> = ({
    isOpen,
    onClose,
    item,
}) => {
    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="エリア 詳細">
            <div className="space-y-8 font-sans">
                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight">{item.areaName}</h3>
                        </div>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                            {item.areaCode}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-6">
                        <SectionHeader icon={<MapPin size={18} />} title="基本情報 (General)" />
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 space-y-4">
                            <DetailRow label="エリアコード" value={item.areaCode} />
                            <DetailRow label="エリア名" value={item.areaName} />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
