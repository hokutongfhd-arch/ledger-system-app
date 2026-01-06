import React, { useState, useEffect, useMemo } from 'react';
import type { Address } from '../../lib/types';
import { useData } from '../context/DataContext';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { formatPhoneNumber, normalizePhoneNumber } from '../../lib/utils/phoneUtils';

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

    const [telParts, setTelParts] = useState({ part1: '', part2: '', part3: '' });
    const [faxParts, setFaxParts] = useState({ part1: '', part2: '', part3: '' });
    const [zipParts, setZipParts] = useState({ part1: '', part2: '' });
    const [labelZipParts, setLabelZipParts] = useState({ part1: '', part2: '' });

    // Prepare Options for Area
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

            const processPhone = (phone: string) => {
                const normalized = normalizePhoneNumber(phone || '');
                let processed = normalized;
                if (processed.length > 0 && processed[0] !== '0') {
                    if (processed.length === 10 || processed.length === 9) {
                        processed = '0' + processed;
                    }
                }

                if (processed.length === 11) {
                    return {
                        part1: processed.slice(0, 3),
                        part2: processed.slice(3, 7),
                        part3: processed.slice(7, 11),
                    };
                } else if (processed.length === 10) {
                    if (processed.startsWith('03') || processed.startsWith('06')) {
                        return {
                            part1: processed.slice(0, 2),
                            part2: processed.slice(2, 6),
                            part3: processed.slice(6, 10),
                        };
                    } else {
                        return {
                            part1: processed.slice(0, 3),
                            part2: processed.slice(3, 6),
                            part3: processed.slice(6, 10),
                        };
                    }
                } else if (phone && phone.includes('-')) {
                    const parts = phone.split('-');
                    return {
                        part1: parts[0] || '',
                        part2: parts[1] || '',
                        part3: parts[2] || '',
                    };
                }
                return { part1: normalized, part2: '', part3: '' };
            };

            setTelParts(processPhone(initialData.tel || ''));
            setFaxParts(processPhone(initialData.fax || ''));

            const processZip = (zip: string) => {
                if (!zip) return { part1: '', part2: '' };
                const digits = zip.replace(/[^0-9]/g, '');
                if (digits.length === 7) {
                    return { part1: digits.slice(0, 3), part2: digits.slice(3) };
                }
                if (zip.includes('-')) {
                    const parts = zip.split('-');
                    return { part1: parts[0] || '', part2: parts[1] || '' };
                }
                return { part1: zip || '', part2: '' };
            };
            setZipParts(processZip(initialData.zipCode || ''));
            setLabelZipParts(processZip(initialData.labelZip || ''));
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');
        const newParts = { ...telParts, [name]: onlyNums };
        setTelParts(newParts);
        const combined = `${newParts.part1}-${newParts.part2}-${newParts.part3}`;
        setFormData(prev => ({ ...prev, tel: combined }));
    };

    const handleFaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');
        const newParts = { ...faxParts, [name]: onlyNums };
        setFaxParts(newParts);
        const combined = `${newParts.part1}-${newParts.part2}-${newParts.part3}`;
        setFormData(prev => ({ ...prev, fax: combined }));
    };

    const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');
        const newParts = { ...zipParts, [name]: onlyNums };
        setZipParts(newParts);
        const combined = `${newParts.part1}-${newParts.part2}`;
        setFormData(prev => ({ ...prev, zipCode: combined }));
    };

    const handleLabelZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');
        const newParts = { ...labelZipParts, [name]: onlyNums };
        setLabelZipParts(newParts);
        const combined = `${newParts.part1}-${newParts.part2}`;
        setFormData(prev => ({ ...prev, labelZip: combined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Final normalization
        const finalTel = formatPhoneNumber(formData.tel);
        const finalFax = formatPhoneNumber(formData.fax);
        onSubmit({ ...formData, tel: finalTel, fax: finalFax });
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">エリア名 (エリアコード)</label>
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ＴＥＬ</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    name="part1"
                                    value={telParts.part1}
                                    onChange={handleTelChange}
                                    maxLength={3}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="03"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part2"
                                    value={telParts.part2}
                                    onChange={handleTelChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="1234"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part3"
                                    value={telParts.part3}
                                    onChange={handleTelChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="5678"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ＦＡＸ</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    name="part1"
                                    value={faxParts.part1}
                                    onChange={handleFaxChange}
                                    maxLength={3}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="03"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part2"
                                    value={faxParts.part2}
                                    onChange={handleFaxChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="1234"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part3"
                                    value={faxParts.part3}
                                    onChange={handleFaxChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="5678"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">〒</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    name="part1"
                                    value={zipParts.part1}
                                    onChange={handleZipChange}
                                    maxLength={3}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="123"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part2"
                                    value={zipParts.part2}
                                    onChange={handleZipChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="4567"
                                />
                            </div>
                        </div>
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">宛名ラベル用〒</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    name="part1"
                                    value={labelZipParts.part1}
                                    onChange={handleLabelZipChange}
                                    maxLength={3}
                                    className="w-16 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="123"
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part2"
                                    value={labelZipParts.part2}
                                    onChange={handleLabelZipChange}
                                    maxLength={4}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center text-sm"
                                    placeholder="4567"
                                />
                            </div>
                        </div>
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
