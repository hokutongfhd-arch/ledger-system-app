
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Employee } from '../employee.types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

interface EmployeeFormProps {
    initialData?: Employee;
    onSubmit: (data: Omit<Employee, 'id'>) => void;
    onCancel: () => void;
    isSelfEdit?: boolean;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, onSubmit, onCancel, isSelfEdit = false }) => {
    const { user } = useAuth();
    const { employees, areas, addresses } = useData();
    const isAdmin = user?.role === 'admin';

    const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
        code: '',
        name: '',
        nameKana: '',
        // companyNo and email removed from form but kept in state/type for compatibility
        companyNo: '',
        departmentCode: '',
        email: '',
        role: 'user',
        password: '',
        gender: '',
        birthDate: '',
        joinDate: '',
        age: 0,
        yearsOfService: 0,
        monthsHasuu: 0,
        employeeType: '',
        salaryType: '',
        costType: '',
        areaCode: '',
        addressCode: '',
        roleTitle: '',
        jobType: '',
    });
    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const [numericError, setNumericError] = useState(false);
    const codeRef = useRef<HTMLInputElement>(null);

    // Prepare Options
    const areaOptions = useMemo(() => {
        return areas.map(a => ({
            label: a.areaName,
            value: a.areaCode,
            subLabel: a.areaCode
        }));
    }, [areas]);

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

    const isComposing = useRef(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'code') {
            // IME入力中は変換をスキップしてそのまま保持
            if (isComposing.current) {
                setFormData(prev => ({ ...prev, [name]: value }));
                return;
            }

            // 数字以外の文字が含まれているかチェック
            const hasNonNumeric = /[^0-9０-９]/.test(value);
            setNumericError(hasNonNumeric);

            // 全角数字を半角に変換し、数字以外を除去
            const sanitizedValue = value
                .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCompositionStart = () => {
        isComposing.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
        isComposing.current = false;
        const value = e.currentTarget.value;

        // 確定時に数字以外の文字が含まれているかチェック
        const hasNonNumeric = /[^0-9０-９]/.test(value);
        setNumericError(hasNonNumeric);

        // 確定時に強制的に半角数字のみに変換
        const sanitizedValue = value
            .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, code: sanitizedValue }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Uniqueness Check
        const isDuplicate = employees.some(emp =>
            emp.code === formData.code &&
            (!initialData || emp.id !== initialData.id)
        );

        if (isDuplicate) {
            setErrorFields(prev => new Set(prev).add('code'));
            setFormData(prev => ({ ...prev, code: '' }));

            // Scroll to the code input
            if (codeRef.current) {
                codeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                codeRef.current.focus();
            }
            return;
        }

        onSubmit(formData);
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-2">
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>社員コード</FormLabel>
                            <Input
                                ref={codeRef}
                                type="text"
                                name="code"
                                value={formData.code}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                                onChange={(e) => {
                                    handleChange(e);
                                    if (errorFields.has('code')) {
                                        const next = new Set(errorFields);
                                        next.delete('code');
                                        setErrorFields(next);
                                    }
                                }}
                                error={errorFields.has('code')}
                                required
                                disabled={isSelfEdit}
                                inputMode="numeric"
                            />
                            {errorFields.has('code') && (
                                <FormError>既に登録されている社員コードです</FormError>
                            )}
                            {numericError && (
                                <FormError>半角数字以外は入力できません</FormError>
                            )}
                        </div>
                        <div>
                            <FormLabel>性別</FormLabel>
                            <Select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                placeholder="選択してください"
                            >
                                <option value="男性">男性</option>
                                <option value="女性">女性</option>
                            </Select>
                        </div>
                        <div>
                            <FormLabel>氏名</FormLabel>
                            <Input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div>
                            <FormLabel>氏名カナ</FormLabel>
                            <Input
                                type="text"
                                name="nameKana"
                                value={formData.nameKana}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>生年月日</FormLabel>
                            <Input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                max={today}
                            />
                        </div>
                        <div>
                            <FormLabel>年齢</FormLabel>
                            <Input
                                type="number"
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Work Info */}
                <div className="space-y-4">
                    <SectionHeader>所属・勤務情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>エリア名 (エリアコード)</FormLabel>
                            <SearchableSelect
                                options={areaOptions}
                                value={formData.areaCode}
                                onChange={(val) => handleSelectChange('areaCode', val)}
                                placeholder="エリアを検索..."
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
                            <FormLabel>入社年月日</FormLabel>
                            <Input
                                type="date"
                                name="joinDate"
                                value={formData.joinDate}
                                onChange={handleChange}
                                max={today}
                            />
                        </div>
                        <div>
                            <FormLabel>勤続年数</FormLabel>
                            <Input
                                type="number"
                                name="yearsOfService"
                                value={formData.yearsOfService}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                        <div>
                            <FormLabel>勤続端数月数</FormLabel>
                            <Input
                                type="number"
                                name="monthsHasuu"
                                value={formData.monthsHasuu}
                                onChange={handleChange}
                                min="0"
                            />
                        </div>
                        <div>
                            <FormLabel>職種</FormLabel>
                            <Input
                                type="text"
                                name="jobType"
                                value={formData.jobType}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>役付</FormLabel>
                            <Input
                                type="text"
                                name="roleTitle"
                                value={formData.roleTitle}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>社員区分</FormLabel>
                            <Input
                                type="text"
                                name="employeeType"
                                value={formData.employeeType}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>給与区分</FormLabel>
                            <Input
                                type="text"
                                name="salaryType"
                                value={formData.salaryType}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <FormLabel>原価区分</FormLabel>
                            <Input
                                type="text"
                                name="costType"
                                value={formData.costType}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* System Info */}
                <div className="space-y-4">
                    <SectionHeader>システム情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel>権限</FormLabel>
                            <Select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                disabled={!isAdmin}
                            >
                                <option value="user">ユーザー</option>
                                <option value="admin">管理者</option>
                            </Select>
                        </div>
                        {isAdmin && (
                            <div>
                                <FormLabel>パスワード</FormLabel>
                                <Input
                                    type="text"
                                    name="password"
                                    value={formData.password || ''}
                                    onChange={handleChange}
                                    className="bg-yellow-50"
                                    placeholder="管理者のみ表示"
                                />
                            </div>
                        )}
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
