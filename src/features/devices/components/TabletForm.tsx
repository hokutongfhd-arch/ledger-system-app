
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Tablet } from '../device.types';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { TextArea } from '../../../components/ui/TextArea';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface TabletFormProps {
    initialData?: Tablet;
    onSubmit: (data: Omit<Tablet, 'id'>) => void;
    onCancel: () => void;
}

export const TabletForm: React.FC<TabletFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { employees, addresses, tablets } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const terminalCodeRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState<Omit<Tablet, 'id'>>({
        terminalCode: '',
        maker: '富士通',
        modelNumber: '',
        officeCode: '',
        addressCode: '',
        address: '',
        status: 'available',
        notes: '',
        history: '',
        employeeCode: '',
        contractYears: '',
    });

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
            const { id, ...rest } = initialData;
            setFormData(rest);
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
                if (name === 'employeeCode') updates.addressCode = '';
                if (name === 'addressCode') updates.employeeCode = '';
            }
            return { ...prev, ...updates };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();

        // Check Terminal Code Uniqueness
        const isTerminalCodeDuplicate = tablets.some(item =>
            item.terminalCode === formData.terminalCode &&
            (!initialData || item.id !== initialData.id)
        );

        if (isTerminalCodeDuplicate) {
            newErrorFields.add('terminalCode');
            setErrorFields(newErrorFields);
            setFormData(prev => ({ ...prev, terminalCode: '' }));

            terminalCodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            terminalCodeRef.current?.focus();
            return;
        }

        const finalContractYears = normalizeContractYear(formData.contractYears || '');
        onSubmit({ ...formData, contractYears: finalContractYears });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>端末CD</FormLabel>
                            <Input
                                ref={terminalCodeRef}
                                type="text"
                                name="terminalCode"
                                value={formData.terminalCode}
                                onChange={handleChange}
                                required
                                readOnly={!!initialData?.id}
                                className={!!initialData?.id ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                                error={errorFields.has('terminalCode')}
                            />
                            {errorFields.has('terminalCode') && <FormError>既に登録されている端末CDです</FormError>}
                        </div>
                        <div>
                            <FormLabel>メーカー</FormLabel>
                            <Input
                                type="text"
                                name="maker"
                                value={formData.maker}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel required>型番</FormLabel>
                            <Input
                                type="text"
                                name="modelNumber"
                                value={formData.modelNumber}
                                onChange={handleChange}
                                required
                            />
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
                    <SectionHeader>場所・使用者</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>社員名(社員コード)</FormLabel>
                            <SearchableSelect
                                options={employeeOptions}
                                value={formData.employeeCode}
                                onChange={(val) => handleSelectChange('employeeCode', val)}
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
                            <FormLabel>事業所CD</FormLabel>
                            <Input
                                type="text"
                                name="officeCode"
                                value={formData.officeCode}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <SectionHeader>その他</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>過去貸与履歴</FormLabel>
                            <TextArea
                                name="history"
                                value={formData.history}
                                onChange={handleChange}
                                rows={2}
                            />
                        </div>
                        <div>
                            <FormLabel>備考</FormLabel>
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
        </form >
    );
};
