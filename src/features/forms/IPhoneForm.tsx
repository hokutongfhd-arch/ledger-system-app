import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { IPhone } from '../../lib/types';
import { useData } from '../context/DataContext';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { formatPhoneNumber, normalizePhoneNumber } from '../../lib/utils/phoneUtils';
import { normalizeContractYear } from '../../lib/utils/stringUtils';

interface IPhoneFormProps {
    initialData?: IPhone;
    onSubmit: (data: Omit<IPhone, 'id'> & { id?: string }) => void;
    onCancel: () => void;
}

export const IPhoneForm: React.FC<IPhoneFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { employees, addresses, iPhones } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const managementNumberRef = useRef<HTMLInputElement>(null);
    const phoneNumberRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<Omit<IPhone, 'id'> & { id?: string }>({
        id: '',
        carrier: '',
        phoneNumber: '',
        managementNumber: '',
        employeeId: '',

        addressCode: '',
        smartAddressId: '',
        smartAddressPw: '',
        lendDate: '',
        receiptDate: '',
        returnDate: '',
        modelName: '',
        notes: '',
        status: '貸出準備中',
        contractYears: '',
    });
    const [phoneParts, setPhoneParts] = useState({ part1: '', part2: '', part3: '' });

    // Prepare Options
    const employeeOptions = useMemo(() => {
        return employees.map(e => ({
            label: e.name,
            value: e.code,
            subLabel: e.code
        }));
    }, [employees]);

    const addressOptions = useMemo(() => {
        return addresses.map(a => ({
            label: a.officeName,
            value: a.addressCode,
            subLabel: a.address
        }));
    }, [addresses]);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            const normalized = normalizePhoneNumber(initialData.phoneNumber || '');

            // 補完後の正規化番号を取得（phoneUtilsのロジックを流用または同等の処理）
            let processed = normalized;
            if (processed.length > 0 && processed[0] !== '0') {
                if (processed.length === 10 || processed.length === 9) {
                    processed = '0' + processed;
                }
            }

            if (processed.length === 11) {
                setPhoneParts({
                    part1: processed.slice(0, 3),
                    part2: processed.slice(3, 7),
                    part3: processed.slice(7, 11),
                });
            } else if (processed.length === 10) {
                if (processed.startsWith('03') || processed.startsWith('06')) {
                    setPhoneParts({
                        part1: processed.slice(0, 2),
                        part2: processed.slice(2, 6),
                        part3: processed.slice(6, 10),
                    });
                } else {
                    setPhoneParts({
                        part1: processed.slice(0, 3),
                        part2: processed.slice(3, 6),
                        part3: processed.slice(6, 10),
                    });
                }
            } else if (initialData.phoneNumber?.includes('-')) {
                const parts = initialData.phoneNumber.split('-');
                setPhoneParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                    part3: parts[2] || '',
                });
            }
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (errorFields.has(name)) {
            const next = new Set(errorFields);
            next.delete(name);
            setErrorFields(next);
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');
        const newParts = { ...phoneParts, [name]: onlyNums };
        setPhoneParts(newParts);

        if (errorFields.has('phoneNumber')) {
            const next = new Set(errorFields);
            next.delete('phoneNumber');
            setErrorFields(next);
        }

        // Update main phoneNumber field
        const combined = `${newParts.part1}-${newParts.part2}-${newParts.part3}`;
        setFormData(prev => ({ ...prev, phoneNumber: combined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        // Check Management Number Uniqueness
        const isManagementNumberDuplicate = iPhones.some(item =>
            item.managementNumber === formData.managementNumber &&
            (!initialData || item.id !== initialData.id)
        );
        if (isManagementNumberDuplicate) {
            newErrorFields.add('managementNumber');
            if (!firstErrorField) firstErrorField = managementNumberRef.current;
        }

        // Check Phone Number Uniqueness (normalize for comparison)
        const currentPhone = `${phoneParts.part1}-${phoneParts.part2}-${phoneParts.part3}`;
        const isPhoneNumberDuplicate = iPhones.some(item =>
            normalizePhoneNumber(item.phoneNumber) === normalizePhoneNumber(currentPhone) &&
            (!initialData || item.id !== initialData.id)
        );
        if (isPhoneNumberDuplicate) {
            newErrorFields.add('phoneNumber');
            if (!firstErrorField) firstErrorField = phoneNumberRef.current; // Focus on the first part
        }

        if (newErrorFields.size > 0) {
            setErrorFields(newErrorFields);

            if (newErrorFields.has('managementNumber')) {
                setFormData(prev => ({ ...prev, managementNumber: '' }));
            }
            if (newErrorFields.has('phoneNumber')) {
                setPhoneParts({ part1: '', part2: '', part3: '' });
                setFormData(prev => ({ ...prev, phoneNumber: '' }));
            }

            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }

        // Final normalization before submit
        const finalPhone = formatPhoneNumber(formData.phoneNumber);
        const finalContractYears = normalizeContractYear(formData.contractYears || '');
        onSubmit({ ...formData, phoneNumber: finalPhone, contractYears: finalContractYears });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                            <input
                                type="text"
                                name="id"
                                value={formData.id || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="新規登録時は自動生成されます（任意入力可）"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">管理番号</label>
                            <input
                                type="text"
                                name="managementNumber"
                                value={formData.managementNumber}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${errorFields.has('managementNumber') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                required
                                ref={managementNumberRef}
                            />
                            {errorFields.has('managementNumber') && <p className="text-red-500 text-sm mt-1">既に登録されている管理番号です</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    name="part1"
                                    value={phoneParts.part1}
                                    onChange={handlePhoneChange}
                                    maxLength={3}
                                    className={`w-16 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-center ${errorFields.has('phoneNumber') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="090"
                                    required
                                    ref={phoneNumberRef}
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part2"
                                    value={phoneParts.part2}
                                    onChange={handlePhoneChange}
                                    maxLength={4}
                                    className={`w-20 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-center ${errorFields.has('phoneNumber') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="1234"
                                    required
                                />
                                <span className="text-gray-500">-</span>
                                <input
                                    type="text"
                                    name="part3"
                                    value={phoneParts.part3}
                                    onChange={handlePhoneChange}
                                    maxLength={4}
                                    className={`w-20 px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-center ${errorFields.has('phoneNumber') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    placeholder="5678"
                                    required
                                />
                            </div>
                            {errorFields.has('phoneNumber') && <p className="text-red-500 text-sm mt-1">既に登録されている電話番号です</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">機種名</label>
                            <input
                                type="text"
                                name="modelName"
                                value={formData.modelName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例: iPhone 13, iPhone SE (第3世代)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">キャリア</label>
                            <select
                                name="carrier"
                                value={formData.carrier}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">選択してください</option>
                                <option value="KDDI">KDDI</option>
                                <option value="Au">Au</option>
                                <option value="Softbank">Softbank</option>
                                <option value="Docomo">Docomo</option>
                                <option value="Rakuten">Rakuten</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">契約年数</label>
                            <input
                                type="text"
                                name="contractYears"
                                value={formData.contractYears || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="例: 2年"
                            />
                        </div>
                    </div>
                </div>

                {/* User Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">社員名 (社員コード)</label>
                            <SearchableSelect
                                options={employeeOptions}
                                value={formData.employeeId}
                                onChange={(val) => handleSelectChange('employeeId', val)}
                                placeholder="社員を検索..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">住所 (住所コード)</label>
                            <SearchableSelect
                                options={addressOptions}
                                value={formData.addressCode}
                                onChange={(val) => handleSelectChange('addressCode', val)}
                                placeholder="住所・拠点を検索..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">貸与日</label>
                            <input
                                type="date"
                                name="lendDate"
                                value={formData.lendDate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">受領書提出日</label>
                            <input
                                type="text"
                                name="receiptDate"
                                value={formData.receiptDate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="日付またはテキスト"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">返却日</label>
                            <input
                                type="date"
                                name="returnDate"
                                value={formData.returnDate}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SMARTアドレス帳ID</label>
                            <input
                                type="text"
                                name="smartAddressId"
                                value={formData.smartAddressId}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SMARTアドレス帳PW</label>
                            <input
                                type="text"
                                name="smartAddressPw"
                                value={formData.smartAddressPw}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div >

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
        </form >
    );
};
