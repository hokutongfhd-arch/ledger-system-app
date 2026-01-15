
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Router } from '../device.types';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { formatPhoneNumber, normalizePhoneNumber } from '../../../lib/utils/phoneUtils';
import { normalizeContractYear } from '../../../lib/utils/stringUtils';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { TextArea } from '../../../components/ui/TextArea';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface RouterFormProps {
    initialData?: Router;
    onSubmit: (data: Omit<Router, 'id'>) => void;
    onCancel: () => void;
}

export const RouterForm: React.FC<RouterFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const { employees, addresses, routers } = useData();
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const terminalCodeRef = useRef<HTMLInputElement>(null);
    const simNumberRef = useRef<HTMLInputElement>(null);
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
        status: 'available',
        contractYears: '',
        employeeCode: '',
    });
    const [phoneParts, setPhoneParts] = useState({ part1: '', part2: '', part3: '' });
    const [is14Digit, setIs14Digit] = useState(false);

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
            const { id, returnDate, notes, ...rest } = initialData;
            // Merge returnDate into notes if it exists
            let mergedNotes = notes || '';
            if (returnDate) {
                const dateStr = new Date(returnDate).toLocaleDateString('ja-JP');
                mergedNotes = mergedNotes ? `${mergedNotes} (返却日: ${dateStr})` : `(返却日: ${dateStr})`;
            }

            setFormData({ ...rest, notes: mergedNotes, returnDate: '' });

            const simNum = initialData.simNumber || '';
            const normalized = normalizePhoneNumber(simNum);

            if (normalized.length === 14) {
                setIs14Digit(true);
                setPhoneParts({ part1: normalized, part2: '', part3: '' });
            } else {
                setIs14Digit(false);
                // 補完後の正規化番号を取得
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
                } else if (simNum.includes('-')) {
                    const parts = simNum.split('-');
                    setPhoneParts({
                        part1: parts[0] || '',
                        part2: parts[1] || '',
                        part3: parts[2] || '',
                    });
                } else {
                    setPhoneParts({ part1: normalized, part2: '', part3: '' });
                }
            }
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'cost' ? parseInt(value) || 0 : value
        }));

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

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const onlyNums = value.replace(/[^0-9]/g, '');

        if (is14Digit) {
            setPhoneParts({ part1: onlyNums, part2: '', part3: '' });
            setFormData(prev => ({ ...prev, simNumber: onlyNums }));
        } else {
            const newParts = { ...phoneParts, [name]: onlyNums };
            setPhoneParts(newParts);
            const combined = `${newParts.part1}-${newParts.part2}-${newParts.part3}`;
            setFormData(prev => ({ ...prev, simNumber: combined }));
        }

        if (errorFields.has('simNumber')) {
            const next = new Set(errorFields);
            next.delete('simNumber');
            setErrorFields(next);
        }
    };

    const togglePhoneMode = () => {
        const nextMode = !is14Digit;
        setIs14Digit(nextMode);
        // Reset or convert current value
        const currentSim = normalizePhoneNumber(formData.simNumber);
        if (nextMode) {
            // To 14-digit mode
            setPhoneParts({ part1: currentSim, part2: '', part3: '' });
            setFormData(prev => ({ ...prev, simNumber: currentSim }));
        } else {
            // To normal mode (try to split)
            setPhoneParts({ part1: currentSim.slice(0, 3), part2: currentSim.slice(3, 7), part3: currentSim.slice(7, 11) });
            const combined = formatPhoneNumber(currentSim);
            setFormData(prev => ({ ...prev, simNumber: combined }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        // Check Terminal Code Uniqueness
        const isTerminalCodeDuplicate = routers.some(item =>
            item.terminalCode === formData.terminalCode &&
            (!initialData || item.id !== initialData.id)
        );

        if (isTerminalCodeDuplicate) {
            newErrorFields.add('terminalCode');
            if (!firstErrorField) firstErrorField = terminalCodeRef.current;
        }

        // Check SIM Number Uniqueness (normalize for comparison)
        const currentSim = is14Digit ? formData.simNumber : `${phoneParts.part1}-${phoneParts.part2}-${phoneParts.part3}`;
        // For router SIM, normalization usually removes hyphens. Check utility usage.
        // normalizePhoneNumber removes hyphens.
        const isSimNumberDuplicate = routers.some(item =>
            normalizePhoneNumber(item.simNumber) === normalizePhoneNumber(currentSim) &&
            (!initialData || item.id !== initialData.id)
        );

        if (isSimNumberDuplicate) {
            newErrorFields.add('simNumber');
            // Focus handling might be tricky with multiple inputs, defaulting to container or first input ref if we can attach it.
            // We will attach ref to the first input part or the main input.
            if (!firstErrorField) firstErrorField = simNumberRef.current;
        }

        if (newErrorFields.size > 0) {
            setErrorFields(newErrorFields);

            if (newErrorFields.has('terminalCode')) {
                setFormData(prev => ({ ...prev, terminalCode: '' }));
            }
            if (newErrorFields.has('simNumber')) {
                setFormData(prev => ({ ...prev, simNumber: '' }));
                setPhoneParts({ part1: '', part2: '', part3: '' });
            }

            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }

        // Normalize SIM number (ensure no delimiters if 14 digit, else format)
        const normalizedSim = formatPhoneNumber(formData.simNumber);
        const normalizedContractStatus = normalizeContractYear(formData.contractStatus || '');
        const normalizedContractYears = normalizeContractYear(formData.contractYears || '');

        onSubmit({
            ...formData,
            simNumber: normalizedSim,
            contractStatus: normalizedContractStatus,
            contractYears: normalizedContractYears
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>No.</FormLabel>
                            <Input name="no" value={formData.no} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>契約状況</FormLabel>
                            <Input name="contractStatus" value={formData.contractStatus} onChange={handleChange} />
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
                                name="contractYears"
                                value={formData.contractYears || ''}
                                onChange={handleChange}
                                placeholder="例: 2年"
                            />
                        </div>
                        <div>
                            <FormLabel>通信キャリア</FormLabel>
                            <Select
                                name="carrier"
                                value={formData.carrier}
                                onChange={handleChange}
                                placeholder="選択してください"
                            >
                                <option value="KDDI">KDDI</option>
                                <option value="Au">Au</option>
                                <option value="Softbank">Softbank</option>
                                <option value="Docomo">Docomo</option>
                                <option value="Rakuten">Rakuten</option>
                            </Select>
                        </div>
                        <div>
                            <FormLabel>機種型番</FormLabel>
                            <Input name="modelNumber" value={formData.modelNumber} onChange={handleChange} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <FormLabel>SIM電番</FormLabel>
                                <button
                                    type="button"
                                    onClick={togglePhoneMode}
                                    className="text-[10px] text-blue-600 hover:underline"
                                >
                                    {is14Digit ? '通常(11桁)入力へ' : '14桁入力へ'}
                                </button>
                            </div>
                            {is14Digit ? (
                                <Input
                                    ref={simNumberRef}
                                    type="text"
                                    name="part1"
                                    value={phoneParts.part1}
                                    onChange={handlePhoneChange}
                                    maxLength={14}
                                    className="font-mono"
                                    placeholder="14桁の番号を入力"
                                    error={errorFields.has('simNumber')}
                                />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Input
                                        ref={simNumberRef}
                                        type="text"
                                        name="part1"
                                        value={phoneParts.part1}
                                        onChange={handlePhoneChange}
                                        maxLength={3}
                                        className="w-16 text-center"
                                        placeholder="090"
                                        error={errorFields.has('simNumber')}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <Input
                                        type="text"
                                        name="part2"
                                        value={phoneParts.part2}
                                        onChange={handlePhoneChange}
                                        maxLength={4}
                                        className="w-20 text-center"
                                        placeholder="1234"
                                        error={errorFields.has('simNumber')}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <Input
                                        type="text"
                                        name="part3"
                                        value={phoneParts.part3}
                                        onChange={handlePhoneChange}
                                        maxLength={4}
                                        className="w-20 text-center"
                                        placeholder="5678"
                                        error={errorFields.has('simNumber')}
                                    />
                                </div>
                            )}
                            {errorFields.has('simNumber') && <FormError>既に登録されているSIM電番です</FormError>}
                        </div>
                        <div>
                            <FormLabel>通信容量</FormLabel>
                            <Input name="dataCapacity" value={formData.dataCapacity} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>端末CD</FormLabel>
                            <Input
                                ref={terminalCodeRef}
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
                    </div>
                </div>

                {/* User Info */}
                <div className="space-y-4">
                    <SectionHeader>使用者情報</SectionHeader>
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
                            <FormLabel>実貸与先</FormLabel>
                            <Input name="actualLender" value={formData.actualLender} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>実貸与先名</FormLabel>
                            <Input name="actualLenderName" value={formData.actualLenderName} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>会社</FormLabel>
                            <Input name="company" value={formData.company} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Network Info */}
                <div className="space-y-4">
                    <SectionHeader>ネットワーク情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>IPアドレス</FormLabel>
                            <Input name="ipAddress" value={formData.ipAddress} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>サブネットマスク</FormLabel>
                            <Input name="subnetMask" value={formData.subnetMask} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>開始IP</FormLabel>
                            <Input name="startIp" value={formData.startIp} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>終了IP</FormLabel>
                            <Input name="endIp" value={formData.endIp} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Cost Info */}
                <div className="space-y-4">
                    <SectionHeader>費用・管理情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>請求元</FormLabel>
                            <Input name="biller" value={formData.biller} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>費用</FormLabel>
                            <Input type="number" name="cost" value={formData.cost} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>費用振替</FormLabel>
                            <Input name="costTransfer" value={formData.costTransfer} onChange={handleChange} />
                        </div>
                        <div>
                            <FormLabel>負担先</FormLabel>
                            <Input name="costBearer" value={formData.costBearer} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Others */}
                <div className="space-y-4">
                    <SectionHeader>その他</SectionHeader>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <FormLabel>貸与履歴</FormLabel>
                            <TextArea
                                name="lendingHistory"
                                value={formData.lendingHistory}
                                onChange={handleChange}
                                rows={2}
                            />
                        </div>
                        <div>
                            <FormLabel>備考(返却日)</FormLabel>
                            <TextArea
                                name="notes"
                                value={formData.notes}
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
