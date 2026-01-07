import React, { useState, useEffect, useRef } from 'react';
import type { Area } from '../../lib/types';

import { useData } from '../context/DataContext';

interface AreaFormProps {
    initialData?: Area;
    onSubmit: (data: Omit<Area, 'id'>) => void;
    onCancel: () => void;
}

export const AreaForm: React.FC<AreaFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Omit<Area, 'id'>>({
        areaCode: '',
        areaName: '',
    });
    const { areas } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const codeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialData) {
            const { id, ...rest } = initialData;
            setFormData(rest);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Uniqueness Check
        const isDuplicate = areas.some(area =>
            area.areaCode === formData.areaCode &&
            (!initialData || area.id !== initialData.id)
        );

        if (isDuplicate) {
            setErrorFields(prev => new Set(prev).add('areaCode'));
            setFormData(prev => ({ ...prev, areaCode: '' }));

            // Scroll to the code input
            if (codeRef.current) {
                codeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                codeRef.current.focus();
            }
            return;
        }

        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">エリアコード</label>
                            <input
                                ref={codeRef}
                                type="text"
                                name="areaCode"
                                value={formData.areaCode}
                                onChange={(e) => {
                                    handleChange(e);
                                    if (errorFields.has('areaCode')) {
                                        const next = new Set(errorFields);
                                        next.delete('areaCode');
                                        setErrorFields(next);
                                    }
                                }}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${errorFields.has('areaCode') ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                required
                            />
                            {errorFields.has('areaCode') && (
                                <p className="text-red-500 text-sm mt-1">既に登録されているエリアコードです</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">エリア名</label>
                            <input
                                type="text"
                                name="areaName"
                                value={formData.areaName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                required
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
