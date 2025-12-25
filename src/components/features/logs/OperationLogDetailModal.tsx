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
    addresses: '住所マスタ',
    tablets: '勤怠タブレット',
    iphones: 'iPhone',
    'feature-phones': 'ガラホ',
    routers: 'モバイルルーター'
};

const FIELD_LABELS: Record<string, string> = {
    // Common
    id: 'ID',
    status: 'ステータス',
    notes: '備考',
    no: '№',

    // Employee
    name: '氏名',
    nameKana: '氏名（カナ）',
    name_kana: '氏名（カナ）',
    code: '社員番号',
    employee_code: '社員番号',
    email: 'メールアドレス',
    role: '権限',
    companyNo: '会社番号',
    company_no: '会社番号',
    departmentCode: '部署コード',
    department_code: '部署コード',
    department: '部署',
    gender: '性別',
    birthDate: '生年月日',
    birth_date: '生年月日',
    joinDate: '入社日',
    join_date: '入社日',
    age: '年齢',
    yearsOfService: '勤続年数',
    years_of_service: '勤続年数',
    employeeType: '社員区分',
    employee_type: '社員区分',
    salaryType: '給与区分',
    salary_type: '給与区分',
    costType: '原価区分',
    cost_type: '原価区分',
    roleTitle: '役職名',
    role_title: '役職名',
    jobType: '職種',
    job_type: '職種',
    profileImage: 'プロフィール画像',
    profile_image: 'プロフィール画像',

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
    costCompany: '負担先会社',
    cost_company: '負担先会社',
    employeeId: '社員コード',
    employee_id: '社員コード',
    addressCode: '住所コード',
    address_code: '住所コード',

    // Tablet / Router Specific
    terminalCode: '端末CD',
    terminal_code: '端末CD',
    maker: 'メーカー',
    modelNumber: '機種型番',
    model_number: '機種型番',
    officeCode: '事業所CD',
    office_code: '事業所CD',
    history: '履歴',
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
    company: '会社',
    actualLender: '実貸与先',
    actual_lender: '実貸与先',
    actualLenderName: '実貸与先名',
    actual_lender_name: '実貸与先名',
    costBearer: '負担先',
    cost_bearer: '負担先',
    lendingHistory: '貸与履歴',
    lending_history: '貸与履歴',
    contractStatus: '契約状況',
    contract_status: '契約状況',

    // Area
    areaCode: 'エリアコード',
    area_code: 'エリアコード',
    areaName: 'エリア名',
    area_name: 'エリア名',

    // Address
    officeName: '拠点名',
    office_name: '拠点名',
    tel: '電話番号',
    fax: 'FAX番号',
    zipCode: '郵便番号',
    zip_code: '郵便番号',
    address: '住所',
    division: '所属',
    area: 'エリア',
    mainPerson: '担当者',
    main_person: '担当者',
    branchNumber: '枝番',
    branch_number: '枝番',
    specialNote: '特記事項',
    special_note: '特記事項',
    attentionNote: '注意事項',
    attention_note: '注意事項',
    labelName: '宛名用氏名',
    label_name: '宛名用氏名',
    labelZip: '宛名用郵便番号',
    label_zip: '宛名用郵便番号',
    labelAddress: '宛名用住所',
    label_address: '宛名用住所'
};

const OP_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    INSERT: { label: '登録', color: 'text-green-600 bg-green-50', icon: <PlusCircle size={16} /> },
    UPDATE: { label: '更新', color: 'text-blue-600 bg-blue-50', icon: <RefreshCw size={16} /> },
    DELETE: { label: '削除', color: 'text-red-600 bg-red-50', icon: <MinusCircle size={16} /> },
};

export const OperationLogDetailModal: React.FC<OperationLogDetailModalProps> = ({ log, isOpen, onClose }) => {
    if (!isOpen || !log) return null;

    const opInfo = OP_MAP[log.operation] || { label: log.operation, color: 'text-gray-600 bg-gray-50', icon: null };

    const renderDiff = () => {
        const oldData = log.oldData || {};
        const newData = log.newData || {};

        // Ignore internal DB fields in diff if possible, or show all
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
            .filter(k => !['id', 'created_at', 'updated_at', 'auth_id'].includes(k))
            .sort();

        const changes = allKeys.filter(key => {
            const oldVal = oldData[key];
            const newVal = newData[key];
            // Shallow compare for JSONB primitives
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
                                <td className="px-4 py-2 font-medium text-xs text-blue-800">
                                    {FIELD_LABELS[key] || key}
                                    {FIELD_LABELS[key] && <div className="text-[9px] text-gray-400 font-mono mt-0.5">{key}</div>}
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-red-600 bg-red-50 px-2 py-1 rounded line-through break-all whitespace-pre-wrap">
                                        {log.oldData?.[key] !== undefined ? String(log.oldData[key]) : <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>}
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center text-gray-400">
                                    <ArrowRight size={14} />
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-green-700 bg-green-50 px-2 py-1 rounded font-medium break-all whitespace-pre-wrap">
                                        {log.newData?.[key] !== undefined ? String(log.newData[key]) : <span className="text-gray-400 italic font-normal text-[10px]">(なし)</span>}
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
                            <p className="text-xs text-gray-500 font-mono italic">ID: {log.id}</p>
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
