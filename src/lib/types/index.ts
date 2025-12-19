export type DeviceStatus = 'available' | 'in-use' | 'broken' | 'discarded' | 'repairing' | 'backup';

export interface Tablet {
    id: string;
    terminalCode: string;
    maker: string;
    modelNumber: string;
    officeCode: string;
    addressCode: string;
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
    smartAddressId: string;
    smartAddressPw: string;
    lendDate: string;
    receiptDate: string;
    notes: string; // notes1
    returnDate: string;
    modelName: string;
    status: '貸出中' | '返却済み' | '貸出準備中';
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
    status: '貸出中' | '返却済み' | '貸出準備中';
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
    employeeType: string;
    salaryType: string;
    costType: string;
    areaCode: string;
    addressCode: string;
    roleTitle: string;
    jobType: string;
    role: 'admin' | 'user';
    profileImage?: string;
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
}

export interface Log {
    id: string;
    timestamp: string;
    user: string;
    target: string;
    action: 'add' | 'update' | 'delete' | 'import';
    details: string;
}

export interface Memo {
    id: number;
    employee_code: string;
    memo: string;
    created_at?: string;
}
