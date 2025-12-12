import React, { useState, useEffect } from 'react';
import type { Area } from '../../types';

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
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">エリアコード</label>
                    <input
                        type="text"
                        name="areaCode"
                        value={formData.areaCode}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        required
                    />
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
