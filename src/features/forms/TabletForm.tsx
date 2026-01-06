import React, { useState, useEffect, useMemo } from 'react';
import type { Tablet } from '../../lib/types';
import { useData } from '../context/DataContext';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { normalizeContractYear } from '../../lib/utils/stringUtils';

interface TabletFormProps {
    initialData?: Tablet;
    onSubmit: (data: Omit<Tablet, 'id'>) => void;
    onCancel: () => void;
}

export const TabletForm: React.FC<TabletFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { employees, addresses } = useData();
    const [formData, setFormData] = useState<Omit<Tablet, 'id'>>({
        terminalCode: '',
        maker: '',
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
            const { id, ...rest } = initialData;
            setFormData(rest);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalContractYears = normalizeContractYear(formData.contractYears || '');
        onSubmit({ ...formData, contractYears: finalContractYears });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">端末CD</label>
                            <input
                                type="text"
                                name="terminalCode"
                                value={formData.terminalCode}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">メーカー</label>
                            <input
                                type="text"
                                name="maker"
                                value={formData.maker}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">型番</label>
                            <input
                                type="text"
                                name="modelNumber"
                                value={formData.modelNumber}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">状況</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="in-use">使用中</option>
                                <option value="backup">予備機</option>
                                <option value="available">在庫</option>
                                <option value="broken">故障</option>
                                <option value="repairing">修理中</option>
                                <option value="discarded">廃棄</option>
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

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">場所・使用者</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">社員名(社員コード)</label>
                            <SearchableSelect
                                options={employeeOptions}
                                value={formData.employeeCode}
                                onChange={(val) => handleSelectChange('employeeCode', val)}
                                placeholder="社員を検索..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">住所(住所コード)</label>
                            <SearchableSelect
                                options={addressOptions}
                                value={formData.addressCode}
                                onChange={(val) => handleSelectChange('addressCode', val)}
                                placeholder="住所・拠点を検索..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">事業所CD</label>
                            <input
                                type="text"
                                name="officeCode"
                                value={formData.officeCode}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">過去貸与履歴</label>
                            <textarea
                                name="history"
                                value={formData.history}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
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
