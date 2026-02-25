
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Area } from '../area.types';
import { useData } from '../../context/DataContext';
import { Input } from '../../../components/ui/Input';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface AreaFormProps {
    initialData?: Area;
    onSubmit: (data: Omit<Area, 'id'>) => void;
    onCancel: () => void;
}

export const AreaForm: React.FC<AreaFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Omit<Area, 'id'>>({
        areaCode: '',
        areaName: '',
        version: 1,
        updatedAt: '',
    });
    const { areas } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const codeRef = useRef<HTMLInputElement>(null);
    const areaNameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            const { id, ...rest } = initialData;
            setFormData(rest);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (errorFields.has(name)) {
            const next = new Set(errorFields);
            next.delete(name);
            setErrorFields(next);
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (/^\d*$/.test(value)) {
            setFormData(prev => ({ ...prev, [name]: value }));

            if (errorFields.has(name)) {
                const next = new Set(errorFields);
                next.delete(name);
                setErrorFields(next);
            }
        }
    };

    // Uniqueness Check
    const isCodeDuplicate = useMemo(() => {
        if (!formData.areaCode) return false;
        return areas.some(area =>
            area.areaCode === formData.areaCode &&
            (!initialData || String(area.id) !== String(initialData.id))
        );
    }, [areas, formData.areaCode, initialData]);

    const isNameDuplicate = useMemo(() => {
        if (!formData.areaName) return false;
        return areas.some(area =>
            area.areaName === formData.areaName &&
            (!initialData || String(area.id) !== String(initialData.id))
        );
    }, [areas, formData.areaName, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        // Required Field Check
        if (!formData.areaCode) {
            newErrorFields.add('areaCode');
            if (!firstErrorField) firstErrorField = codeRef.current;
        }
        if (!formData.areaName) {
            newErrorFields.add('areaName');
            if (!firstErrorField) firstErrorField = areaNameRef.current;
        }

        if (isCodeDuplicate) {
            newErrorFields.add('areaCode');
            if (!firstErrorField) firstErrorField = codeRef.current;
        }

        if (isNameDuplicate) {
            newErrorFields.add('areaName');
            if (!firstErrorField) firstErrorField = areaNameRef.current;
        }

        if (newErrorFields.size > 0) {
            setErrorFields(newErrorFields);
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }

        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-8">
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>エリアコード</FormLabel>
                            <Input
                                ref={codeRef}
                                type="text"
                                name="areaCode"
                                value={formData.areaCode}
                                onChange={handleNumberChange}
                                placeholder="半角数字のみ"
                                error={errorFields.has('areaCode')}
                                readOnly={!!initialData}
                                className={!!initialData ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                            />
                            {errorFields.has('areaCode') && !areas.some(a => a.areaCode === formData.areaCode && (!initialData || a.id !== initialData.id)) && <FormError>この項目は必須です</FormError>}
                            {errorFields.has('areaCode') && (
                                areas.some(a => a.areaCode === formData.areaCode && (!initialData || a.id !== initialData.id)) ?
                                    <FormError>既に登録されているエリアコードです</FormError> : null
                            )}
                        </div>

                        <div>
                            <FormLabel required>エリア名</FormLabel>
                            <Input
                                ref={areaNameRef}
                                type="text"
                                name="areaName"
                                value={formData.areaName}
                                onChange={handleChange}
                                error={errorFields.has('areaName')}
                            />
                            {errorFields.has('areaName') && !formData.areaName && <FormError>この項目は必須です</FormError>}
                            {errorFields.has('areaName') && formData.areaName && isNameDuplicate && <FormError>既に登録されているエリア名です</FormError>}
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
