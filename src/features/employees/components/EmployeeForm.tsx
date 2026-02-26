
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Employee, EmployeeInput } from '../employee.types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { FormLabel, FormError } from '../../../components/ui/Form';
import { SectionHeader } from '../../../components/ui/Section';

import { calculateAge, calculateServicePeriod } from '../../../lib/utils/dateHelpers';

interface EmployeeFormProps {
    initialData?: Employee;
    onSubmit: (data: EmployeeInput) => void;
    onCancel: () => void;
    isSelfEdit?: boolean;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ initialData, onSubmit, onCancel, isSelfEdit = false }) => {
    const { user } = useAuth();
    const { employees, areas, addresses } = useData();
    const isAdmin = user?.role === 'admin';

    const [formData, setFormData] = useState<EmployeeInput>({
        code: '',
        name: '',
        nameKana: '',
        // companyNo and email removed from form but kept in state/type for compatibility
        companyNo: '',
        departmentCode: '',
        email: '',
        role: 'admin',
        password: '',
        gender: '',
        birthDate: '',
        joinDate: '',
        age: 0,
        yearsOfService: 0,
        monthsHasuu: 0,
        areaCode: '',
        addressCode: '',
        version: 1,
        updatedAt: '',
    });

    // Splitting name and nameKana for the form UI
    const [nameParts, setNameParts] = useState({
        lastName: '',
        firstName: '',
        lastNameKana: '',
        firstNameKana: ''
    });

    const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
    const [numericError, setNumericError] = useState(false);
    const [emailError, setEmailError] = useState(false);
    const codeRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    const firstNameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

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

            // Split name and nameKana by first space (assuming half-width or full-width space)
            const splitName = rest.name.split(/[\s　]+/);
            const splitNameKana = rest.nameKana.split(/[\s　]+/);

            setNameParts({
                lastName: splitName[0] || '',
                firstName: splitName.slice(1).join(' ') || '',
                lastNameKana: splitNameKana[0] || '',
                firstNameKana: splitNameKana.slice(1).join(' ') || ''
            });
        }
    }, [initialData]);

    const isComposing = useRef(false);

    const handleNamePartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Block numbers and symbols (Half-width and Full-width)
        // Regex includes: 0-9, ０-９, ASCII symbols, Full-width symbols/punctuation
        if (/[0-9０-９!-/:-@[-`{-~！-／：-＠［-｀｛-～、。,.?？!！]/.test(value)) {
            return;
        }

        // Remove ANY spaces (half-width, full-width, ideographic)
        const sanitized = value.replace(/[\s　]+/g, '');
        setNameParts(prev => ({ ...prev, [name]: sanitized }));

        // Clear error if user starts typing
        if (errorFields.has(name)) {
            const next = new Set(errorFields);
            next.delete(name);
            setErrorFields(next);
        }
    };

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

        if (name === 'birthDate') {
            const age = calculateAge(value);
            setFormData(prev => ({ ...prev, birthDate: value, age }));
            return;
        }

        if (name === 'email') {
            // IME入力中は変換をスキップしてそのまま保持
            if (isComposing.current) {
                setFormData(prev => ({ ...prev, [name]: value }));
                return;
            }

            // 全角文字が含まれているかチェック
            const hasZenKaku = /[^\x00-\x7F]/.test(value);
            setEmailError(hasZenKaku);

            // 全角文字を半角に変換し、ASCII以外を除去
            const sanitizedValue = value
                .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角ASCIIを半角に
                .replace(/[^\x00-\x7F]/g, ''); // それ以外の非ASCIIを除去
            setFormData(prev => ({ ...prev, [name]: sanitizedValue }));

            // Clear error if user starts typing
            if (errorFields.has(name)) {
                const next = new Set(errorFields);
                next.delete(name);
                setErrorFields(next);
            }
            return;
        }

        if (name === 'joinDate') {
            const period = calculateServicePeriod(value);
            setFormData(prev => ({ ...prev, joinDate: value, yearsOfService: period.years, monthsHasuu: period.months }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error if user starts typing
        if (errorFields.has(name)) {
            const next = new Set(errorFields);
            next.delete(name);
            setErrorFields(next);
        }
    };

    const handleCompositionStart = () => {
        isComposing.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
        isComposing.current = false;
        const value = e.currentTarget.value;
        const name = e.currentTarget.getAttribute('name');

        if (name === 'code') {
            // 確定時に数字以外の文字が含まれているかチェック
            const hasNonNumeric = /[^0-9０-９]/.test(value);
            setNumericError(hasNonNumeric);

            // 確定時に強制的に半角数字のみに変換
            const sanitizedValue = value
                .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, code: sanitizedValue }));
        } else if (name === 'email') {
            // 確定時に全角文字が含まれているかチェック
            const hasZenKaku = /[^\x00-\x7F]/.test(value);
            setEmailError(hasZenKaku);

            // 確定時に強制的に半角（ASCII）のみに変換
            const sanitizedValue = value
                .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[^\x00-\x7F]/g, '');
            setFormData(prev => ({ ...prev, email: sanitizedValue }));
        }
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };


    // Uniqueness Check (社員コード)
    const isDuplicate = useMemo(() => {
        if (!formData.code) return false;
        return employees.some(emp =>
            emp.code === formData.code &&
            (!initialData || String(emp.id) !== String(initialData.id))
        );
    }, [employees, formData.code, initialData]);

    // Uniqueness Check (メールアドレス)
    const isEmailDuplicate = useMemo(() => {
        if (!formData.email) return false;
        return employees.some(emp =>
            emp.email &&
            emp.email.toLowerCase() === formData.email.toLowerCase() &&
            (!initialData || String(emp.id) !== String(initialData.id))
        );
    }, [employees, formData.email, initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrorFields = new Set<string>();
        let firstErrorField: HTMLElement | null = null;

        // Required Field Check
        if (!formData.code) {
            newErrorFields.add('code');
            if (!firstErrorField) firstErrorField = codeRef.current;
        }
        if (!nameParts.lastName) {
            newErrorFields.add('lastName');
            if (!firstErrorField) firstErrorField = lastNameRef.current;
        }
        if (!nameParts.firstName) {
            newErrorFields.add('firstName');
            if (!firstErrorField) firstErrorField = firstNameRef.current;
        }
        if (!formData.email) {
            newErrorFields.add('email');
            if (!firstErrorField) firstErrorField = emailRef.current;
        }


        // Password Required Check (New Registration only)
        if (isAdmin && !initialData && !formData.password) {
            newErrorFields.add('password');
            if (!firstErrorField) firstErrorField = passwordRef.current;
        }

        if (isDuplicate) {
            newErrorFields.add('code');
            if (!firstErrorField) firstErrorField = codeRef.current;
        }

        // メールアドレス重複チェック
        if (isEmailDuplicate) {
            newErrorFields.add('email_duplicate');
            if (!firstErrorField) firstErrorField = emailRef.current;
        }

        // Password Validation (8+ digits, numeric only)
        if (isAdmin && formData.password) {
            const password = formData.password;
            if (password.length < 8) {
                newErrorFields.add('password_length');
                if (!firstErrorField) firstErrorField = passwordRef.current;
            }
            if (!/^[0-9]+$/.test(password)) {
                newErrorFields.add('password_format');
                if (!firstErrorField) firstErrorField = passwordRef.current;
            }
        }

        if (newErrorFields.size > 0) {
            setErrorFields(newErrorFields);
            if (isDuplicate) {
                // Special handling for duplicate error message logic if needed, 
                // but typically duplicate is just another error.
                // We kept the specific error message logic in render.
            }

            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
            return;
        }

        // Combine name parts with half-width space for storage
        const combinedName = `${nameParts.lastName} ${nameParts.firstName}`.trim();
        const combinedNameKana = `${nameParts.lastNameKana} ${nameParts.firstNameKana}`.trim();

        onSubmit({
            ...formData,
            name: combinedName,
            nameKana: combinedNameKana
        });
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-2" noValidate>
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-4">
                    <SectionHeader>基本情報</SectionHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <FormLabel required>社員コード</FormLabel>
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
                                disabled={isSelfEdit}
                                readOnly={!!initialData}
                                className={!!initialData ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                                inputMode="numeric"
                            />
                            {errorFields.has('code') && !numericError && !employees.some(e => e.code === formData.code && (!initialData || e.id !== initialData.id)) && (
                                <FormError>この項目は必須です</FormError>
                            )}
                            {errorFields.has('code') && employees.some(e => e.code === formData.code && (!initialData || e.id !== initialData.id)) && (
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
                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <div>
                                <FormLabel required>氏名</FormLabel>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Input
                                            ref={lastNameRef}
                                            type="text"
                                            name="lastName"
                                            value={nameParts.lastName}
                                            onChange={handleNamePartChange}
                                            placeholder="苗字"
                                            error={errorFields.has('lastName')}
                                        />
                                        {errorFields.has('lastName') && <FormError>この項目は必須です</FormError>}
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            ref={firstNameRef}
                                            type="text"
                                            name="firstName"
                                            value={nameParts.firstName}
                                            onChange={handleNamePartChange}
                                            placeholder="名前"
                                            error={errorFields.has('firstName')}
                                        />
                                        {errorFields.has('firstName') && <FormError>この項目は必須です</FormError>}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <FormLabel>氏名カナ</FormLabel>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            name="lastNameKana"
                                            value={nameParts.lastNameKana}
                                            onChange={handleNamePartChange}
                                            placeholder="ミョウジ"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            name="firstNameKana"
                                            value={nameParts.firstNameKana}
                                            onChange={handleNamePartChange}
                                            placeholder="ナマエ"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <FormLabel required>メールアドレス</FormLabel>
                            <Input
                                ref={emailRef}
                                type="email"
                                name="email"
                                value={formData.email}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                                onChange={handleChange}
                                placeholder="taro.yamada@example.com"
                                error={errorFields.has('email') || emailError}
                            />
                            {errorFields.has('email') && !emailError && !errorFields.has('email_duplicate') && <FormError>この項目は必須です</FormError>}
                            {emailError && <FormError>全角文字は入力できません</FormError>}
                            {errorFields.has('email_duplicate') && <FormError>既に登録されているメールアドレスです</FormError>}
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
                                disabled
                                readOnly
                                className="bg-gray-100 text-gray-500 cursor-not-allowed"
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
                                min={formData.birthDate}
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
                                disabled
                                readOnly
                                className="bg-gray-100 text-gray-500 cursor-not-allowed"
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
                                disabled
                                readOnly
                                className="bg-gray-100 text-gray-500 cursor-not-allowed"
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
                        {isAdmin && !initialData && (
                            <div>
                                <FormLabel required>パスワード</FormLabel>
                                <Input
                                    ref={passwordRef}
                                    type="text"
                                    name="password"
                                    value={formData.password || ''}
                                    onChange={(e) => {
                                        handleChange(e);
                                        if (errorFields.has('password')) {
                                            const next = new Set(errorFields);
                                            next.delete('password');
                                            setErrorFields(next);
                                        }
                                        if (errorFields.has('password_length')) {
                                            const next = new Set(errorFields);
                                            next.delete('password_length');
                                            setErrorFields(next);
                                        }
                                        if (errorFields.has('password_format')) {
                                            const next = new Set(errorFields);
                                            next.delete('password_format');
                                            setErrorFields(next);
                                        }
                                    }}
                                    className="bg-yellow-50"
                                    placeholder="管理者のみ表示 (半角数字8文字以上)"
                                    error={errorFields.has('password') || errorFields.has('password_length') || errorFields.has('password_format')}
                                />
                                {errorFields.has('password') && (
                                    <FormError>この項目は必須です</FormError>
                                )}
                                {errorFields.has('password_length') && (
                                    <FormError>パスワードは8文字以上必要です</FormError>
                                )}
                                {errorFields.has('password_format') && (
                                    <FormError>パスワードは半角数字のみ使用できます</FormError>
                                )}
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
