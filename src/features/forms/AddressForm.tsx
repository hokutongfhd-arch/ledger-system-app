import React, { useState, useEffect, useMemo } from 'react';
import type { Address } from '../../lib/types';
import { useData } from '../context/DataContext';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

interface AddressFormProps {
    initialData?: Address;
    onSubmit: (data: Omit<Address, 'id'>) => void;
    onCancel: () => void;
}

const AddressInputField = ({
    label,
    name,
    value,
    onChange,
    type = 'text',
    required = false
}: {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    required?: boolean
}) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required={required}
        />
    </div>
);

export const AddressForm: React.FC<AddressFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { areas } = useData();
    const [formData, setFormData] = useState<Omit<Address, 'id'>>({
        no: '',
        addressCode: '',
        officeName: '',
        tel: '',
        fax: '',
        type: '',
        zipCode: '',
        address: '',
        notes: '',
        division: '',
        area: '',
        mainPerson: '',
        branchNumber: '',
        specialNote: '',
        labelName: '',
        labelZip: '',
        labelAddress: '',
        attentionNote: '',
    });

    // Prepare Options for Area
    // heuristic: Address.area seems to store the Area Name (based on field name 'area' vs 'areaCode')
    // We map Area Name to value.
    const areaOptions = useMemo(() => {
        return areas.map(a => ({
            label: a.areaName,
            value: a.areaName,
            subLabel: a.areaCode
        }));
    }, [areas]);

    useEffect(() => {
        if (initialData) {
            const { id, ...rest } = initialData;
            setFormData(rest);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-2">
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AddressInputField label="No." name="no" value={formData.no} onChange={handleChange} />
                        <AddressInputField label="住所コード" name="addressCode" value={formData.addressCode} onChange={handleChange} required />
                        <AddressInputField label="事業所名" name="officeName" value={formData.officeName} onChange={handleChange} required />
                        <AddressInputField label="事業部" name="division" value={formData.division} onChange={handleChange} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
                            <SearchableSelect
                                options={areaOptions}
                                value={formData.area}
                                onChange={(val) => handleSelectChange('area', val)}
                                placeholder="エリアを検索..."
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">連絡先情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AddressInputField label="ＴＥＬ" name="tel" value={formData.tel} onChange={handleChange} />
                        <AddressInputField label="ＦＡＸ" name="fax" value={formData.fax} onChange={handleChange} />
                        <AddressInputField label="〒" name="zipCode" value={formData.zipCode} onChange={handleChange} />
                        <div className="md:col-span-2">
                            <AddressInputField label="住所" name="address" value={formData.address} onChange={handleChange} required />
                        </div>
                    </div>
                </div>

                {/* Detailed Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">詳細情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AddressInputField label="区分" name="type" value={formData.type} onChange={handleChange} />
                        <AddressInputField label="主担当" name="mainPerson" value={formData.mainPerson} onChange={handleChange} />
                        <AddressInputField label="枝番" name="branchNumber" value={formData.branchNumber} onChange={handleChange} />
                        <AddressInputField label="※" name="specialNote" value={formData.specialNote} onChange={handleChange} />
                    </div>
                </div>

                {/* Label Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">宛名ラベル情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AddressInputField label="宛名ラベル用" name="labelName" value={formData.labelName} onChange={handleChange} />
                        <AddressInputField label="宛名ラベル用〒" name="labelZip" value={formData.labelZip} onChange={handleChange} />
                        <div className="md:col-span-2">
                            <AddressInputField label="宛名ラベル用住所" name="labelAddress" value={formData.labelAddress} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Others */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                rows={2}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">注意書き</label>
                            <textarea
                                name="attentionNote"
                                value={formData.attentionNote}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                rows={2}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                    キャンセル
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                    保存
                </button>
            </div>
        </form>
    );
};
