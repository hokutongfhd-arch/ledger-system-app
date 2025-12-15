import React, { useState, useEffect } from 'react';
import type { Router } from '../../types';

interface RouterFormProps {
    initialData?: Router;
    onSubmit: (data: Omit<Router, 'id'>) => void;
    onCancel: () => void;
}

export const RouterForm: React.FC<RouterFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<Omit<Router, 'id'>>({
        no: '',
        biller: '',
        terminalCode: '',
        modelNumber: '',
        carrier: '',
        cost: 0,
        costTransfer: '',
        dataCapacity: '',
        simNumber: '',
        ipAddress: '',
        subnetMask: '',
        startIp: '',
        endIp: '',
        company: '',
        addressCode: '',
        actualLender: '',
        costBearer: '',
        actualLenderName: '',
        lendingHistory: '',
        notes: '',
        contractStatus: '',
        returnDate: '',
        contractYears: '',
    });

    useEffect(() => {
        if (initialData) {
            const { id, returnDate, notes, ...rest } = initialData;
            // Merge returnDate into notes if it exists
            let mergedNotes = notes || '';
            if (returnDate) {
                const dateStr = new Date(returnDate).toLocaleDateString('ja-JP');
                mergedNotes = mergedNotes ? `${mergedNotes} (返却日: ${dateStr})` : `(返却日: ${dateStr})`;
            }

            setFormData({ ...rest, notes: mergedNotes, returnDate: '' });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'cost' ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">基本情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">管理番号</label>
                            <input type="text" name="no" value={formData.no} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">契約ステータス</label>
                            <input type="text" name="contractStatus" value={formData.contractStatus} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">契約年数</label>
                            <input type="text" name="contractYears" value={formData.contractYears || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="例: 2年" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">キャリア</label>
                            <select
                                name="carrier"
                                value={formData.carrier}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">機種名</label>
                            <input type="text" name="modelNumber" value={formData.modelNumber} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SIM電話番号</label>
                            <input type="text" name="simNumber" value={formData.simNumber} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">データ容量</label>
                            <input type="text" name="dataCapacity" value={formData.dataCapacity} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">端末暗証番号</label>
                            <input type="text" name="terminalCode" value={formData.terminalCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>
                </div>

                {/* User Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">使用者情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">実質貸与者名</label>
                            <input type="text" name="actualLenderName" value={formData.actualLenderName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">実質貸与者</label>
                            <input type="text" name="actualLender" value={formData.actualLender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">会社</label>
                            <input type="text" name="company" value={formData.company} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">住所コード</label>
                            <input type="text" name="addressCode" value={formData.addressCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>
                </div>

                {/* Network Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">ネットワーク情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">IPアドレス</label>
                            <input type="text" name="ipAddress" value={formData.ipAddress} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">サブネットマスク</label>
                            <input type="text" name="subnetMask" value={formData.subnetMask} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">開始IP</label>
                            <input type="text" name="startIp" value={formData.startIp} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">終了IP</label>
                            <input type="text" name="endIp" value={formData.endIp} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>
                </div>

                {/* Cost Info */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">費用・管理情報</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">請求元</label>
                            <input type="text" name="biller" value={formData.biller} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">月額コスト</label>
                            <input type="number" name="cost" value={formData.cost} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">費用振替</label>
                            <input type="text" name="costTransfer" value={formData.costTransfer} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">費用負担者</label>
                            <input type="text" name="costBearer" value={formData.costBearer} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                        </div>
                    </div>
                </div>

                {/* Others */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4">その他</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">貸与履歴</label>
                            <textarea
                                name="lendingHistory"
                                value={formData.lendingHistory}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">備考(返却日)</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={2}
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
        </form>
    );
};
