
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Address } from '../../../lib/types';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { formatPhoneNumber, normalizePhoneNumber } from '../../../lib/utils/phoneUtils';
import { useAutoFocus } from '../../../hooks/useAutoFocus';
import { Input } from '../../../components/ui/Input';
import { TextArea } from '../../../components/ui/TextArea';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface AddressFormProps {
    initialData?: Address;
    onSubmit: (data: Omit<Address, 'id'>) => void;
    onCancel: () => void;
}

export const AddressForm: React.FC<AddressFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { areas, addresses } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());

    // Refs
    const officeNameRef = useRef<HTMLInputElement>(null);
    const addressRef = useRef<HTMLInputElement>(null);

    const telPart1Ref = useRef<HTMLInputElement>(null);
    const telPart2Ref = useRef<HTMLInputElement>(null);
    const telPart3Ref = useRef<HTMLInputElement>(null);

    const faxPart1Ref = useRef<HTMLInputElement>(null);
    const faxPart2Ref = useRef<HTMLInputElement>(null);
    const faxPart3Ref = useRef<HTMLInputElement>(null);

    const zipPart1Ref = useRef<HTMLInputElement>(null);
    const zipPart2Ref = useRef<HTMLInputElement>(null);

    const labelZipPart1Ref = useRef<HTMLInputElement>(null);
    const labelZipPart2Ref = useRef<HTMLInputElement>(null);

    const codePart1Ref = useRef<HTMLInputElement>(null);
    const codePart2Ref = useRef<HTMLInputElement>(null);

    // Form Data State
    const [formData, setFormData] = useState<Omit<Address, 'id'>>({
        no: '',
        addressCode: '',
        officeName: '',
        tel: '',
        fax: '',
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
        accountingCode: '',
        type: '',
    });

    // Split Parts State
    const [telParts, setTelParts] = useState({ part1: '', part2: '', part3: '' });
    const [faxParts, setFaxParts] = useState({ part1: '', part2: '', part3: '' });
    const [zipParts, setZipParts] = useState({ part1: '', part2: '' });
    const [labelZipParts, setLabelZipParts] = useState({ part1: '', part2: '' });
    const [addressCodeParts, setAddressCodeParts] = useState({ part1: '', part2: '' });

    const areaOptions = useMemo(() => {
        return areas.map(area => ({
            value: area.areaCode,
            label: area.areaName,
        }));
    }, [areas]);

    const { handleAutoTab } = useAutoFocus(codePart1Ref);

    // Initialize from initialData
    useEffect(() => {
        if (initialData) {
            // Check if initialData.area is a name and convert to code if possible
            let areaValue = initialData.area;
            const matchedArea = areas.find(a => a.areaName === initialData.area);
            if (matchedArea) {
                areaValue = matchedArea.areaCode;
            }

            setFormData({
                ...initialData,
                area: areaValue
            });

            // Parse TEL
            if (initialData.tel) {
                const parts = initialData.tel.split('-');
                setTelParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                    part3: parts[2] || '',
                });
            }

            // Parse FAX
            if (initialData.fax) {
                const parts = initialData.fax.split('-');
                setFaxParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                    part3: parts[2] || '',
                });
            }

            // Parse Zip
            if (initialData.zipCode) {
                const parts = initialData.zipCode.split('-');
                setZipParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                });
            }

            // Parse Label Zip
            if (initialData.labelZip) {
                const parts = initialData.labelZip.split('-');
                setLabelZipParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                });
            }

            // Parse Address Code
            if (initialData.addressCode) {
                const parts = initialData.addressCode.split('-');
                setAddressCodeParts({
                    part1: parts[0] || '',
                    part2: parts[1] || '',
                });
            }
        }
    }, [initialData]);

    // Handlers
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (errorFields.has(name)) {
            const newErrorFields = new Set(errorFields);
            newErrorFields.delete(name);
            setErrorFields(newErrorFields);
        }
    };

    const handleSelectChange = (name: keyof Omit<Address, 'id'>, value: string) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (errorFields.has(name)) {
            const newErrorFields = new Set(errorFields);
            newErrorFields.delete(name);
            setErrorFields(newErrorFields);
        }
    };

    const handleAccountingCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        // Allow only numbers
        if (/^\d*$/.test(value)) {
            setFormData(prev => ({
                ...prev,
                accountingCode: value
            }));
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (/^\d*$/.test(value)) {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
            if (errorFields.has(name)) {
                const newErrorFields = new Set(errorFields);
                newErrorFields.delete(name);
                setErrorFields(newErrorFields);
            }
        }
    };

    const handleAddressCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!/^\d*$/.test(value)) return;

        const newParts = { ...addressCodeParts, [name]: value };
        setAddressCodeParts(newParts);

        if (name === 'part1') handleAutoTab(e, 4, codePart2Ref);

        const fullCode = `${newParts.part1}-${newParts.part2}`.replace(/^-+|-+$/g, '');
        setFormData(prev => ({ ...prev, addressCode: fullCode }));

        if (errorFields.has('addressCode')) {
            const newErrorFields = new Set(errorFields);
            newErrorFields.delete('addressCode');
            setErrorFields(newErrorFields);
        }
    };

    const handleTelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!/^\d*$/.test(value)) return;

        const newParts = { ...telParts, [name]: value };
        setTelParts(newParts);

        if (name === 'part1') handleAutoTab(e, 3, telPart2Ref);
        if (name === 'part2') handleAutoTab(e, 4, telPart3Ref);

        const fullTel = `${newParts.part1}-${newParts.part2}-${newParts.part3}`.replace(/^-+|-+$/g, '');
        setFormData(prev => ({ ...prev, tel: fullTel }));
    };

    const handleFaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!/^\d*$/.test(value)) return;

        const newParts = { ...faxParts, [name]: value };
        setFaxParts(newParts);

        if (name === 'part1') handleAutoTab(e, 3, faxPart2Ref);
        if (name === 'part2') handleAutoTab(e, 4, faxPart3Ref);

        const fullFax = `${newParts.part1}-${newParts.part2}-${newParts.part3}`.replace(/^-+|-+$/g, '');
        setFormData(prev => ({ ...prev, fax: fullFax }));
    };

    const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!/^\d*$/.test(value)) return;

        const newParts = { ...zipParts, [name]: value };
        setZipParts(newParts);

        if (name === 'part1') handleAutoTab(e, 3, zipPart2Ref);

        const fullZip = `${newParts.part1}-${newParts.part2}`.replace(/^-+|-+$/g, '');
        setFormData(prev => ({ ...prev, zipCode: fullZip }));
    };

    const handleLabelZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!/^\d*$/.test(value)) return;

        const newParts = { ...labelZipParts, [name]: value };
        setLabelZipParts(newParts);

        if (name === 'part1') handleAutoTab(e, 3, labelZipPart2Ref);

        const fullZip = `${newParts.part1}-${newParts.part2}`.replace(/^-+|-+$/g, '');
        setFormData(prev => ({ ...prev, labelZip: fullZip }));
    };

    // Uniqueness Check
    const isAddressCodeDuplicate = useMemo(() => {
        if (!formData.addressCode) return false;
        return addresses.some(addr =>
            addr.addressCode === formData.addressCode &&
            (!initialData || String(addr.id) !== String(initialData.id))
        );
    }, [addresses, formData.addressCode, initialData]);

    const isOfficeNameDuplicate = useMemo(() => {
        if (!formData.officeName) return false;
        return addresses.some(addr =>
            addr.officeName === formData.officeName &&
            (!initialData || String(addr.id) !== String(initialData.id))
        );
    }, [addresses, formData.officeName, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        // Required Field Check
        if (!formData.addressCode || !/^\d{4}-\d{2}$/.test(formData.addressCode)) {
            newErrorFields.add('addressCode');
            if (!firstErrorField) firstErrorField = codePart1Ref.current;
        }
        if (!formData.officeName) {
            newErrorFields.add('officeName');
            if (!firstErrorField) firstErrorField = officeNameRef.current;
        }
        if (!formData.zipCode || formData.zipCode.length < 8) { // 3 digits + '-' + 4 digits = 8 chars
            newErrorFields.add('zipCode');
            if (!firstErrorField) firstErrorField = zipPart1Ref.current;
        }
        if (!formData.address) {
            newErrorFields.add('address');
            if (!firstErrorField) firstErrorField = addressRef.current;
        }

        if (isAddressCodeDuplicate) {
            newErrorFields.add('addressCode');
            if (!firstErrorField) firstErrorField = codePart1Ref.current;
        }

        if (isOfficeNameDuplicate) {
            newErrorFields.add('officeName');
            if (!firstErrorField) firstErrorField = officeNameRef.current;
        }

        if (newErrorFields.size > 0) {
            setErrorFields(newErrorFields);
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }

        // Final normalization
        const finalTel = formatPhoneNumber(formData.tel);
        const finalFax = formatPhoneNumber(formData.fax);

        // Ensure empty strings for undefined fields if necessary, though formData initializes them
        onSubmit({
            ...formData,
            tel: finalTel,
            fax: finalFax,
            // Ensure zip codes follow format if needed
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-2" noValidate>
            <div className="space-y-8">
                {/* Main Information */}
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>事業所コード</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={codePart1Ref}
                                    name="part1"
                                    value={addressCodeParts.part1}
                                    onChange={handleAddressCodeChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="1234"
                                    error={errorFields.has('addressCode')}
                                    readOnly={!!initialData}
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={codePart2Ref}
                                    name="part2"
                                    value={addressCodeParts.part2}
                                    onChange={handleAddressCodeChange}
                                    maxLength={2}
                                    className="w-16 text-center"
                                    placeholder="56"
                                    error={errorFields.has('addressCode')}
                                    readOnly={!!initialData}
                                />
                            </div>
                            {errorFields.has('addressCode') && !formData.addressCode && <FormError>この項目は必須です</FormError>}
                            {errorFields.has('addressCode') && formData.addressCode && !/^\d{4}-\d{2}$/.test(formData.addressCode) && <FormError>形式が正しくありません (xxxx-xx)</FormError>}
                            {errorFields.has('addressCode') && formData.addressCode === initialData?.addressCode && addresses.some(a => a.addressCode === formData.addressCode && (!initialData || a.id !== initialData.id)) && (
                                <FormError>既に登録されている事業所コードです</FormError>
                            )}
                        </div>
                        <div>
                            <FormLabel required>事業所名</FormLabel>
                            <Input
                                ref={officeNameRef}
                                name="officeName"
                                value={formData.officeName}
                                onChange={handleChange}
                                error={errorFields.has('officeName')}
                            />
                            {errorFields.has('officeName') && !formData.officeName && <FormError>この項目は必須です</FormError>}
                            {errorFields.has('officeName') && formData.officeName && isOfficeNameDuplicate && <FormError>既に登録されている事業所名です</FormError>}
                        </div>
                        <div>
                            <FormLabel>エリアコード</FormLabel>
                            <SearchableSelect
                                options={areaOptions}
                                value={formData.area}
                                onChange={(val) => handleSelectChange('area', val)}
                                placeholder="エリアを検索..."
                            />
                        </div>
                        <div>
                            <FormLabel>No.</FormLabel>
                            <Input name="no" value={formData.no} onChange={handleNumberChange} placeholder="半角数字のみ" />
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-4">
                    <SectionHeader>連絡先情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>〒</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={zipPart1Ref}
                                    name="part1"
                                    value={zipParts.part1}
                                    onChange={handleZipChange}
                                    maxLength={3}
                                    className="w-16 text-center"
                                    placeholder="123"
                                    error={errorFields.has('zipCode')}
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={zipPart2Ref}
                                    name="part2"
                                    value={zipParts.part2}
                                    onChange={handleZipChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="4567"
                                    error={errorFields.has('zipCode')}
                                />
                            </div>
                            {errorFields.has('zipCode') && <FormError>この項目は必須です（ハイフン込み7桁）</FormError>}
                        </div>
                        <div className="md:col-span-2">
                            <FormLabel required>住所</FormLabel>
                            <Input
                                ref={addressRef}
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                error={errorFields.has('address')}
                            />
                            {errorFields.has('address') && <FormError>この項目は必須です</FormError>}
                        </div>
                        <div>
                            <FormLabel>ＴＥＬ</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={telPart1Ref}
                                    name="part1"
                                    value={telParts.part1}
                                    onChange={handleTelChange}
                                    maxLength={3}
                                    className="w-16 text-center"
                                    placeholder="03"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={telPart2Ref}
                                    name="part2"
                                    value={telParts.part2}
                                    onChange={handleTelChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="1234"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={telPart3Ref}
                                    name="part3"
                                    value={telParts.part3}
                                    onChange={handleTelChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="5678"
                                />
                            </div>
                        </div>
                        <div>
                            <FormLabel>ＦＡＸ</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={faxPart1Ref}
                                    name="part1"
                                    value={faxParts.part1}
                                    onChange={handleFaxChange}
                                    maxLength={3}
                                    className="w-16 text-center"
                                    placeholder="03"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={faxPart2Ref}
                                    name="part2"
                                    value={faxParts.part2}
                                    onChange={handleFaxChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="1234"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={faxPart3Ref}
                                    name="part3"
                                    value={faxParts.part3}
                                    onChange={handleFaxChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="5678"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                    <SectionHeader>詳細情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>事業部</FormLabel>
                            <Input name="division" value={formData.division} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>経理コード</FormLabel>
                            <Input
                                name="accountingCode"
                                value={formData.accountingCode}
                                onChange={handleAccountingCodeChange}
                                placeholder="半角数字のみ"
                            />
                        </div>
                        <div>
                            <FormLabel>エリアコード(確認用)</FormLabel>
                            <SearchableSelect
                                options={areaOptions}
                                value={formData.area}
                                onChange={(val) => handleSelectChange('area', val)}
                                placeholder="エリアを検索..."
                            />
                        </div>
                        <div>
                            <FormLabel>主担当</FormLabel>
                            <Input name="mainPerson" value={formData.mainPerson} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>枝番</FormLabel>
                            <Input name="branchNumber" value={formData.branchNumber} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>※</FormLabel>
                            <Input name="specialNote" value={formData.specialNote} onChange={handleChange} />
                        </div>
                        <div className="md:col-span-2">
                            <FormLabel>備考</FormLabel>
                            <TextArea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                {/* Label Info */}
                <div className="space-y-4">
                    <SectionHeader>宛名ラベル情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>宛名ラベル用</FormLabel>
                            <Input name="labelName" value={formData.labelName} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>宛名ラベル用〒</FormLabel>
                            <div className="flex items-center gap-2">
                                <Input
                                    ref={labelZipPart1Ref}
                                    name="part1"
                                    value={labelZipParts.part1}
                                    onChange={handleLabelZipChange}
                                    maxLength={3}
                                    className="w-16 text-center"
                                    placeholder="123"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    ref={labelZipPart2Ref}
                                    name="part2"
                                    value={labelZipParts.part2}
                                    onChange={handleLabelZipChange}
                                    maxLength={4}
                                    className="w-20 text-center"
                                    placeholder="4567"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <FormLabel>宛名ラベル用住所</FormLabel>
                            <Input name="labelAddress" value={formData.labelAddress} onChange={handleChange} />
                        </div>
                        <div className="md:col-span-2">
                            <FormLabel>注意書き</FormLabel>
                            <TextArea
                                name="attentionNote"
                                value={formData.attentionNote}
                                onChange={handleChange}
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
