import React from 'react';
import type { OperationLog } from '../../../lib/types';
import { X, Clock, User, Database, Activity, ArrowRight, MinusCircle, PlusCircle, RefreshCw } from 'lucide-react';

interface OperationLogDetailModalProps {
    log: OperationLog | null;
    isOpen: boolean;
    onClose: () => void;
}

const TABLE_LABELS: Record<string, string> = {
    employees: '社員マスタ',
    areas: 'エリアマスタ',
    addresses: '事業所マスタ',
    tablets: '勤怠タブレット',
    iphones: 'iPhone',
    featurephones: 'ガラホ',
    routers: 'モバイルルーター'
};

const FIELD_LABELS: Record<string, string> = {
    // Common
    id: 'ID',
    status: '状況',
    notes: '備考',
    no: '№',

    // Employee
    name: '氏名',
    name_kana: '氏名（カナ）',
    nameKana: '氏名（カナ）',
    code: '社員コード',
    employee_code: '社員コード',
    email: 'メールアドレス',
    role: '権限',
    gender: '性別',
    birthDate: '生年月日',
    birth_date: '生年月日',
    age: '年齢',
    joinDate: '入社年月日',
    join_date: '入社年月日',
    yearsOfService: '勤続年数',
    years_of_service: '勤続年数',
    monthsHasuu: '勤続端数月数',
    months_hasuu: '勤続端数月数',
    area_code: 'エリアコード',
    addressCode: '事業所コード',
    address_code: '事業所コード',
    age_at_month_end: '年齢',
    authority: '権限',
    birthday: '生年月日',
    cost_class: '原価区分',
    employee_class: '社員区分',
    job_type: '職種',
    months_in_service: '勤続端数月数',
    position: '役職名',
    salary_class: '給与区分',
    years_in_service: '勤続年数',

    // Device General
    managementNumber: '管理番号',
    management_number: '管理番号',
    modelName: '機種名',
    model_name: '機種名',
    phoneNumber: '電話番号',
    phone_number: '電話番号',
    carrier: 'キャリア',
    contractYears: '契約年数',
    contract_years: '契約年数',
    lendDate: '貸与日',
    lend_date: '貸与日',
    receiptDate: '受領書提出日',
    receipt_date: '受領書提出日',
    returnDate: '返却日',
    return_date: '返却日',

    // Tablet / Router Specific
    terminalCode: '端末CD',
    terminal_code: '端末CD',
    maker: 'メーカー',
    modelNumber: '機種型番',
    model_number: '機種型番',
    history: '過去貸与履歴',
    lendingHistory: '過去貸与履歴',
    lending_history: '過去貸与履歴',
    lend_history: '過去貸与履歴',
    smartAddressId: 'スマートアドレスID',
    smart_address_id: 'スマートアドレスID',
    smartAddressPw: 'スマートアドレスPW',
    smart_address_pw: 'スマートアドレスPW',
    biller: '請求元',
    cost: '費用',
    costTransfer: '費用振替',
    cost_transfer: '費用振替',
    dataCapacity: '通信容量',
    data_capacity: '通信容量',
    data_limit: '通信容量',
    simNumber: 'SIM電番',
    sim_number: 'SIM電番',
    ipAddress: 'IPアドレス',
    ip_address: 'IPアドレス',
    subnetMask: 'サブネットマスク',
    subnet_mask: 'サブネットマスク',
    startIp: '開始IP',
    start_ip: '開始IP',
    endIp: '終了IP',
    end_ip: '終了IP',
    costBearer: '負担先',
    cost_bearer: '負担先',
    contractStatus: '契約状況',
    contract_status: '契約状況',
    costCompany: '負担先',
    cost_company: '負担先',
    employeeId: '使用者',
    employee_id: '使用者',
    employeeCode: '使用者',

    // Area
    areaName: 'エリア名',
    area_name: 'エリア名',

    // Address
    officeName: '事業所名',
    office_name: '事業所名',
    fax: 'FAX',
    tel: '電話番号',
    zipCode: '〒',
    zip_code: '〒',
    zip: '〒',
    address: '住所',
    division: '事業部',
    area: 'エリアコード',
    mainPerson: '主担当',
    main_person: '主担当',
    branchNumber: '枝番',
    branch_number: '枝番',
    specialNote: '※',
    special_note: '※',
    attentionNote: '※',
    attention_note: '※',
    labelName: '宛名ラベル用',
    label_name: '宛名ラベル用',
    labelZip: '宛名ラベル用〒',
    label_zip: '宛名ラベル用〒',
    labelAddress: '宛名ラベル用住所',
    label_address: '宛名ラベル用住所',
    branch_no: '枝番',
    caution: '※',
    department: '事業部',
    remarks: '注意書き',
    supervisor: '主担当',
    type: '区分',
    category: '区分',
    accountingCode: '経理コード',
    accounting_code: '経理コード'
};

const TABLE_FIELD_ORDER: Record<string, string[]> = {
    employees: [
        'code', 'employee_code', 'gender', 'status', 'name', 'nameKana', 'name_kana', 'email', 'birthday', 'birthDate', 'birth_date', 'age', 'age_at_month_end',
        'areaCode', 'area_code', 'addressCode', 'address_code', 'joinDate', 'join_date', 'years_in_service', 'yearsOfService', 'years_of_service',
        'months_in_service', 'monthsHasuu', 'months_hasuu', 'authority', 'role', 'employee_class', 'salary_class', 'cost_class', 'position', 'job_type'
    ],
    addresses: [
        'addressCode', 'address_code', 'officeName', 'office_name', 'area', 'no', 'zipCode', 'zip_code', 'zip', 'address',
        'tel', 'fax', 'division', 'department', 'accountingCode', 'accounting_code', 'supervisor', 'mainPerson', 'main_person',
        'branchNumber', 'branch_number', 'branch_no', 'specialNote', 'special_note', 'caution', 'attentionNote', 'attention_note',
        'notes', 'labelName', 'label_name', 'labelZip', 'label_zip', 'labelAddress', 'label_address', 'remarks'
    ],
    areas: ['areaCode', 'area_code', 'areaName', 'area_name'],
    iphones: [
        'managementNumber', 'management_number', 'phoneNumber', 'phone_number', 'modelName', 'model_name', 'contractYears',
        'contract_years', 'carrier', 'status', 'employee_code', 'employeeCode', 'employeeId', 'employee_id', 'addressCode', 'address_code',
        'costBearer', 'cost_bearer', 'receiptDate', 'receipt_date', 'lendDate', 'lend_date', 'returnDate', 'return_date',
        'smartAddressId', 'smart_address_id', 'smartAddressPw', 'smart_address_pw', 'notes'
    ],
    featurephones: [
        'managementNumber', 'management_number', 'phoneNumber', 'phone_number', 'modelName', 'model_name', 'contractYears',
        'contract_years', 'carrier', 'status', 'employee_code', 'employeeCode', 'employeeId', 'employee_id', 'addressCode', 'address_code',
        'costCompany', 'cost_company', 'receiptDate', 'receipt_date', 'lendDate', 'lend_date', 'returnDate', 'return_date', 'notes'
    ],
    tablets: [
        'terminalCode', 'terminal_code', 'modelNumber', 'model_number', 'maker', 'contractYears', 'contract_years', 'status',
        'employee_code', 'employeeCode', 'employeeId', 'employee_id', 'addressCode', 'address_code', 'costBearer', 'cost_bearer',
        'lend_history', 'lending_history', 'lendingHistory', 'notes'
    ],
    routers: [
        'terminalCode', 'terminal_code', 'simNumber', 'sim_number', 'modelNumber', 'model_number', 'carrier', 'dataCapacity',
        'data_capacity', 'data_limit', 'contractStatus', 'contract_status', 'contractYears', 'contract_years', 'status', 'employee_code',
        'employeeCode', 'employeeId', 'employee_id', 'addressCode', 'address_code', 'ipAddress', 'ip_address', 'subnetMask',
        'subnet_mask', 'startIp', 'start_ip', 'endIp', 'end_ip', 'biller', 'costBearer', 'cost_bearer', 'cost', 'costTransfer',
        'cost_transfer', 'lending_history', 'lendingHistory', 'lend_history', 'notes'
    ]
};

const OP_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    INSERT: { label: '登録', color: 'text-green-600 bg-green-50', icon: <PlusCircle size={16} /> },
    UPDATE: { label: '更新', color: 'text-blue-600 bg-blue-50', icon: <RefreshCw size={16} /> },
    DELETE: { label: '削除', color: 'text-red-600 bg-red-50', icon: <MinusCircle size={16} /> },
};

const STATUS_VALUE_MAP: Record<string, string> = {
    'available': '在庫',
    'in-use': '使用中',
    'broken': '故障',
    'discarded': '廃棄',
    'repairing': '修理中',
    'backup': '予備機'
};

const formatLogValue = (key: string, value: any): React.ReactNode => {
    // 1. Handle explicit null/undefined
    if (value === undefined || value === null) return <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>;

    const strVal = String(value);

    // 2. Handle Status Translation
    if (key === 'status') {
        return STATUS_VALUE_MAP[strVal] || strVal;
    }

    // 3. Handle "Return" (Empty values for specific fields)
    const RETURN_FIELDS = ['employee_code', 'employeeId', 'employee_id', 'address_code', 'addressCode', 'office_code', 'officeCode'];
    if (RETURN_FIELDS.includes(key) && strVal === '') {
        return '返却';
    }

    // 4. Handle other empty strings
    if (strVal === '') {
        return <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>;
    }

    return strVal;
};

export const OperationLogDetailModal: React.FC<OperationLogDetailModalProps> = ({ log, isOpen, onClose }) => {
    if (!isOpen || !log) return null;

    const opInfo = OP_MAP[log.operation] || { label: log.operation, color: 'text-gray-600 bg-gray-50', icon: null };

    const renderDiff = () => {
        const oldData = log.oldData || {};
        const newData = log.newData || {};

        const IGNORE_KEYS = ['id', 'created_at', 'updated_at', 'auth_id', 'user_name', 'operator_id', 'operator_name'];
        if (log.tableName === 'routers') {
            IGNORE_KEYS.push(
                'actual_lender', 'actual_lender_name', 'company',
                'no', '№', 'payer'
            );
        }
        if (log.tableName === 'featurephones') {
            IGNORE_KEYS.push('cost_bearer');
        }
        if (log.tableName === 'tablets') {
            IGNORE_KEYS.push('address', 'office_code', 'officeCode');
        }
        if (log.tableName === 'employees') {
            IGNORE_KEYS.push('employee_class', 'salary_class', 'cost_class', 'position', 'job_type');
        }
        if (log.tableName === 'addresses') {
            IGNORE_KEYS.push('type', 'category');
        }

        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
            .filter(k => !IGNORE_KEYS.includes(k));

        // Sort based on TABLE_FIELD_ORDER
        const fieldOrder = TABLE_FIELD_ORDER[log.tableName] || [];
        const sortedKeys = allKeys.sort((a, b) => {
            const indexA = fieldOrder.indexOf(a);
            const indexB = fieldOrder.indexOf(b);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        const changes = sortedKeys.filter(key => {
            const oldVal = oldData[key];
            const newVal = newData[key];
            return JSON.stringify(oldVal) !== JSON.stringify(newVal);
        });

        if (changes.length === 0) {
            return <div className="text-center py-8 text-text-muted italic">変更箇所はありません</div>;
        }

        return (
            <div className="border rounded-lg overflow-hidden border-border bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-border">
                        <tr>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/4">項目名</th>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/3">変更前</th>
                            <th className="px-4 py-2 w-8"></th>
                            <th className="px-4 py-2 text-left font-bold text-gray-700 w-1/3">変更後</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {changes.map(key => (
                            <tr key={key} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2 font-medium text-xs">
                                    <div className="text-blue-800 font-bold mb-0.5">
                                        {(() => {
                                            if (log.tableName === 'routers') {
                                                if (key === 'carrier') return '通信キャリア';
                                                if (['history', 'lendingHistory', 'lending_history', 'lend_history'].includes(key)) return '貸与履歴';
                                            }
                                            return FIELD_LABELS[key] || key;
                                        })()}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono">
                                        {key}
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-red-600 bg-red-50 px-2 py-1 rounded break-all whitespace-pre-wrap">
                                        {formatLogValue(key, log.oldData?.[key])}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center text-gray-400">
                                    <ArrowRight size={14} />
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-green-700 bg-green-50 px-2 py-1 rounded font-medium break-all whitespace-pre-wrap">
                                        {formatLogValue(key, log.newData?.[key])}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${opInfo.color}`}>
                            {opInfo.icon}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">操作ログ詳細</h2>
                            {/* <p className="text-xs text-gray-500 font-mono italic">ID: {log.id}</p> */}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors group">
                        <X size={20} className="text-gray-500 group-hover:rotate-90 transition-transform" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-background">

                    {/* Meta Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <InfoItem icon={<Clock size={16} />} label="日時" value={new Date(log.timestamp).toLocaleString('ja-JP')} />
                        <InfoItem icon={<User size={16} />} label="実行者" value={`${log.actorName} (${log.actorCode})`} />
                        <InfoItem icon={<Activity size={16} />} label="操作" value={opInfo.label} />
                        <InfoItem icon={<Database size={16} />} label="対象テーブル" value={TABLE_LABELS[log.tableName] || log.tableName} />
                    </div>

                    {/* Diff View */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                            データ変更履歴
                        </h3>
                        {renderDiff()}
                    </div>

                    {/* Raw Metadata (Optional/Hidden in detailed view usually, but we have newData/oldData) */}
                    {/* Collapsible/Hidden Raw Section could go here if needed */}

                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-bold transition-all shadow-sm active:scale-95">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="p-3 bg-white rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            {icon} {label}
        </div>
        <div className="text-sm font-bold text-gray-900 truncate" title={value}>
            {value}
        </div>
    </div>
);
