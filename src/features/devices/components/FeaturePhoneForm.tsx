
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { FeaturePhone } from '../device.types';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { formatPhoneNumber, normalizePhoneNumber } from '../../../lib/utils/phoneUtils';
import { useAutoFocus } from '../../../hooks/useAutoFocus';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { TextArea } from '../../../components/ui/TextArea';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface FeaturePhoneFormProps {
    initialData?: FeaturePhone;
    onSubmit: (data: Omit<FeaturePhone, 'id'> & { id?: string }) => void;
    onCancel: () => void;
}

export const FeaturePhoneForm: React.FC<FeaturePhoneFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { employees, addresses, featurePhones } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const managementNumberRef = useRef<HTMLInputElement>(null);
    const phonePart1Ref = useRef<HTMLInputElement>(null);
    const phonePart2Ref = useRef<HTMLInputElement>(null);
    const phonePart3Ref = useRef<HTMLInputElement>(null);

    const { handleAutoTab } = useAutoFocus();
    const [formData, setFormData] = useState<Omit<FeaturePhone, 'id'> & { id?: string }>({
        id: '',
        carrier: 'KDDI',
        phoneNumber: '',
        managementNumber: '',
        employeeId: '',
        addressCode: '',
        costCompany: '',
        lendDate: '',
        receiptDate: '',
        returnDate: '',
        modelName: '',
        notes: '',
        contractYears: '',
        status: 'available',
    });
    const [phoneParts, setPhoneParts] = useState({ part1: '', part2: '', part3: '' });

    // Prepare Options
    const employeeOptions = useMemo(() => {
        const options = employees.map(e => ({
            label: e.name,
            value: e.code,
            subLabel: e.code
        }));
        return [{ label: '返却', value: '', subLabel: '' }, ...options];
    }, [employees]);

    const addressOptions = useMemo(() => {
        const options = addresses.map(a => ({
            label: a.officeName,
            value: a.addressCode,
            subLabel: a.address
        }));
        return [{ label: '返却', value: '', subLabel: '' }, ...options];
    }, [addresses]);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);

            const normalized = normalizePhoneNumber(initialData.phoneNumber || '');

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
        setFormData(prev => {
            const updates: any = { [name]: value };
            if (value === '') {
                if (name === 'employeeId') updates.addressCode = '';
                if (name === 'addressCode') updates.employeeId = '';
            }
            return { ...prev, ...updates };
        });
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

        if (name === 'part1') {
            if (onlyNums.length >= 3) phonePart2Ref.current?.focus();
        }
        if (name === 'part2') {
            if (onlyNums.length >= 4) phonePart3Ref.current?.focus();
        }

        const combined = `${newParts.part1}-${newParts.part2}-${newParts.part3}`;
        setFormData(prev => ({ ...prev, phoneNumber: combined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        const isManagementNumberDuplicate = featurePhones.some(item =>
            item.managementNumber === formData.managementNumber &&
            (!initialData || item.id !== initialData.id)
        );
        if (isManagementNumberDuplicate) {
            newErrorFields.add('managementNumber');
            if (!firstErrorField) firstErrorField = managementNumberRef.current;
        }

        const currentPhone = `${phoneParts.part1}-${phoneParts.part2}-${phoneParts.part3}`;
        const isPhoneNumberDuplicate = featurePhones.some(item =>
            normalizePhoneNumber(item.phoneNumber) === normalizePhoneNumber(currentPhone) &&
            (!initialData || item.id !== initialData.id)
        );
        if (isPhoneNumberDuplicate) {
            newErrorFields.add('phoneNumber');
            if (!firstErrorField) firstErrorField = phonePart1Ref.current;
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

        const finalPhone = formatPhoneNumber(formData.phoneNumber);
        const finalContractYears = normalizeContractYear(formData.contractYears || '');
        onSubmit({ ...formData, phoneNumber: finalPhone, contractYears: finalContractYears });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>管理番号</FormLabel>
                            <Input
                                ref={managementNumberRef}
                                type="text"
                                name="managementNumber"
                                value={formData.managementNumber}
                                onChange={handleChange}
                                required
                                readOnly={!!initialData?.id}
                                className={!!initialData?.id ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                                error={errorFields.has('managementNumber')}
                            />
                            {errorFields.has('managementNumber') && <FormError>既に登録されている管理番号です</FormError>}
                        </div>
                        <div>
                            <FormLabel>機種名</FormLabel>
                            <Input
                                type="text"
                                name="modelName"
                                value={formData.modelName}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel required>電話番号</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={phonePart1Ref}
                                    type="text"
                                    name="part1"
                                    value={phoneParts.part1}
                                    onChange={handlePhoneChange}
                                    maxLength={3}
                                    className="w-16 text-center"
                                    placeholder="090"
                                    required
                                    error={errorFields.has('phoneNumber')}
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={phonePart2Ref}
                                    type="text"
                                    name="part2"
                                    value={phoneParts.part2}
                                    onChange={handlePhoneChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="1234"
                                    required
                                    error={errorFields.has('phoneNumber')}
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={phonePart3Ref}
                                    type="text"
                                    name="part3"
                                    value={phoneParts.part3}
                                    onChange={handlePhoneChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="5678"
                                    required
                                    error={errorFields.has('phoneNumber')}
                                />
                            </div>
                            {errorFields.has('phoneNumber') && <FormError>既に登録されている電話番号です</FormError>}
                        </div>
                        <div>
                            <FormLabel>キャリア</FormLabel>
                            <Select
                                name="carrier"
                                value={formData.carrier}
                                onChange={handleChange}
                                placeholder="選択してください"
                            >
                                <option value="KDDI">KDDI</option>

                                <option value="SoftBank">SoftBank</option>
                                <option value="Docomo">Docomo</option>
                                <option value="Rakuten">Rakuten</option>
                                <option value="その他">その他</option>
                            </Select>
                        </div>
                        <div>
                            <FormLabel>状況</FormLabel>
                            <Select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <option value="in-use">使用中</option>
                                <option value="backup">予備機</option>
                                <option value="available">在庫</option>
                                <option value="broken">故障</option>
                                <option value="repairing">修理中</option>
                                <option value="discarded">廃棄</option>
                            </Select>
                        </div>
                        <div>
                            <FormLabel>契約年数</FormLabel>
                            <Input
                                type="text"
                                name="contractYears"
                                value={formData.contractYears || ''}
                                onChange={handleChange}
                                placeholder="例: 2年"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <SectionHeader>使用者情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div>
                            <FormLabel>社員名 (社員コード)</FormLabel>
                            <SearchableSelect
                                options={employeeOptions}
                                value={formData.employeeId}
                                onChange={(val) => handleSelectChange('employeeId', val)}
                                placeholder="社員を検索..."
                            />
                        </div>
                        <div>
                            <FormLabel>事業所 (事業所コード)</FormLabel>
                            <SearchableSelect
                                options={addressOptions}
                                value={formData.addressCode}
                                onChange={(val) => handleSelectChange('addressCode', val)}
                                placeholder="事業所を検索..."
                            />
                        </div>
                        <div>
                            <FormLabel>貸与日</FormLabel>
                            <Input
                                type="date"
                                name="lendDate"
                                value={formData.lendDate}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <SectionHeader>管理情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>負担先会社</FormLabel>
                            <Input
                                type="text"
                                name="costCompany"
                                value={formData.costCompany}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>受領書提出日</FormLabel>
                            <Input
                                type="text"
                                name="receiptDate"
                                value={formData.receiptDate}
                                onChange={handleChange}
                                placeholder="日付またはテキスト"
                            />
                        </div>
                        <div>
                            <FormLabel>返却日</FormLabel>
                            <Input
                                type="date"
                                name="returnDate"
                                value={formData.returnDate}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <SectionHeader>その他</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <FormLabel>備考1</FormLabel>
                            <TextArea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={3}
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
