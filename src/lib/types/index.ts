export type DeviceStatus = 'available' | 'in-use' | 'broken' | 'discarded' | 'repairing' | 'backup';

export interface Tablet {
    id: string;
    terminalCode: string;
    maker: string;
    modelNumber: string;
    officeCode: string;
    addressCode: string;
    costBearer: string;
    address: string;
    notes: string;
    history: string;
    status: DeviceStatus;
    contractYears?: string;
    employeeCode: string;
}

export interface IPhone {
    id: string;
    carrier: string;
    phoneNumber: string;
    managementNumber: string;
    employeeId: string; // Employee Code

    addressCode: string;
    costBearer: string;
    smartAddressId: string;
    smartAddressPw: string;
    lendDate: string;
    receiptDate: string;
    notes: string; // notes1
    returnDate: string;
    modelName: string;
    status: DeviceStatus;
    contractYears?: string;
}

export interface FeaturePhone {
    id: string;
    carrier: string;
    phoneNumber: string;
    managementNumber: string;
    employeeId: string;

    addressCode: string;
    costCompany: string;
    lendDate: string;
    receiptDate: string;
    notes: string; // notes1
    returnDate: string;
    modelName: string;
    status: DeviceStatus;
    contractYears?: string;
}

export interface Router {
    id: string;
    no: string; // №
    biller: string; // 請求元
    terminalCode: string; // 端末ＣＤ
    modelNumber: string; // 機種型番
    carrier: string; // 通信キャリア
    cost: number; // 費用
    costTransfer: string; // 費用振替
    dataCapacity: string; // 通信容量
    simNumber: string; // SIM電番
    ipAddress: string; // ＩＰアドレス
    subnetMask: string; // サブネットマスク
    startIp: string; // 開始ＩＰ
    endIp: string; // 終了ＩＰ
    company: string; // 会社
    addressCode: string; // 住所コード
    actualLender: string; // 実貸与先
    costBearer: string; // 負担先
    actualLenderName: string; // 実貸与先名
    lendingHistory: string; // 貸与履歴
    notes: string; // 備考
    returnDate: string; // 返却日 (part of notes requirement but good to have separate)
    status: DeviceStatus;
    contractStatus: string; // 契約状況
    contractYears?: string;
    employeeCode: string;
}



export interface Employee {
    id: string;
    code: string;
    name: string;
    nameKana: string;
    companyNo: string;
    departmentCode: string;
    email: string;
    password?: string;
    gender: string;
    birthDate: string;
    joinDate: string;
    age: number;
    yearsOfService: number;
    monthsHasuu: number;
    areaCode: string;
    addressCode: string;
    // TODO: Future Extension - Consider adding 'operator' | 'viewer' roles for more granular permissions
    role: 'admin' | 'user';
    profileImage?: string;
    authId?: string;
}

export interface Area {
    id: string;
    areaCode: string;
    areaName: string;
}

export interface Address {
    id: string;
    no: string;
    addressCode: string;
    officeName: string;
    tel: string;
    fax: string;

    type: string;
    zipCode: string;
    address: string;
    notes: string;
    division: string;
    area: string;
    mainPerson: string;
    branchNumber: string;
    specialNote: string;
    labelName: string;
    labelZip: string;
    labelAddress: string;
    attentionNote: string;
    accountingCode: string;
}

export type AnomalyResponseStatus = 'pending' | 'investigating' | 'completed';

export interface Log {
    id: string;
    timestamp: string;        // occurred_at
    actorName: string;        // actor_name
    actorEmployeeCode: string;
    target: string;           // Display (Japanese)
    targetRaw: string;        // DB Value
    targetId: string;
    action: string;           // Display (Japanese)
    actionRaw: string;        // DB Value
    result: 'success' | 'failure';
    metadata: any;
    ipAddress: string;
    details: string;          // UI Generated Summary
    user: string;             // Compatibility fallback
    is_archived?: boolean;
    archived_at?: string;
    is_acknowledged?: boolean;
    acknowledged_by?: string;      // UUID (Admin User ID)
    acknowledged_by_name?: string; // Display Name
    acknowledged_at?: string;
    response_status?: AnomalyResponseStatus;
    response_note?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Memo {
    id: number;
    employee_code: string;
    memo: string;
    created_at?: string;
}

export interface AuditReport {
    id: string;
    report_type: 'daily' | 'weekly' | 'summary' | 'detailed';
    period_start: string;
    period_end: string;
    summary: {
        total_actions: number;
        login_failures: number;
        anomalies: number;
        unacknowledged_anomalies?: number;
        breakdown_by_action: Record<string, number>;
        breakdown_by_result: Record<string, number>;
        generated_at: string;
    };
    generated_by?: string;      // Employee Code
    generated_by_name?: string; // Employee Name
    pdf_path?: string;
    checksum?: string;
    created_at: string;
}

export interface OperationLog {
    id: string;
    timestamp: string;        // occurred_at
    tableName: string;        // table_name
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    oldData: any;             // old_data
    newData: any;             // new_data
    actorName: string;        // actor_name
    actorCode: string;        // actor_code
    isArchived: boolean;      // is_archived
    archivedAt?: string;      // archived_at
}
