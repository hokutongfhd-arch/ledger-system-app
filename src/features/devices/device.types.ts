export type DeviceStatus = 'available' | 'in-use' | 'broken' | 'discarded' | 'repairing' | 'backup';

export interface Tablet {
    id: string;
    terminalCode: string;
    maker: string;
    modelNumber: string;
    addressCode: string;
    costBearer: string;
    address: string;
    notes: string;
    history: string;
    status: DeviceStatus;
    contractYears?: string;
    employeeCode: string;
    version: number;
    updatedAt: string;
}


export interface TabletUsageHistory {
    id: string;
    tabletId: string;
    employeeCode: string;
    officeCode: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}


export interface RouterUsageHistory {
    id: string;
    routerId: string;
    employeeCode: string;
    officeCode: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}

export interface IPhone {
    id: string;
    carrier: string;
    phoneNumber: string;
    managementNumber: string;
    employeeCode: string; // 修正: employeeId から employeeCode へ
    addressCode: string;
    costBearer: string;
    smartAddressId: string;
    smartAddressPw: string;
    lendDate: string;
    receiptDate: string;
    notes: string;
    returnDate: string;
    modelName: string;
    status: DeviceStatus;
    contractYears?: string;
    version: number;
    updatedAt: string;
}

export interface IPhoneUsageHistory {
    id: string;
    iphoneId: string;
    employeeCode: string;
    officeCode: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}

export interface FeaturePhone {
    id: string;
    carrier: string;
    phoneNumber: string;
    managementNumber: string;
    employeeCode: string; // 修正: employeeId から employeeCode へ
    addressCode: string;
    costCompany: string;
    lendDate: string;
    receiptDate: string;
    notes: string;
    returnDate: string;
    modelName: string;
    status: DeviceStatus;
    contractYears?: string;
    version: number;
    updatedAt: string;
}


export interface FeaturePhoneUsageHistory {
    id: string;
    featurePhoneId: string;
    employeeCode: string;
    officeCode: string;
    startDate: string;
    endDate: string;
    createdAt: string;
}

export interface Router {
    id: string;
    biller: string;
    terminalCode: string;
    modelNumber: string;
    carrier: string;
    cost: number;
    costTransfer: string;
    dataCapacity: string;
    simNumber: string;
    ipAddress: string;
    subnetMask: string;
    startIp: string;
    endIp: string;
    addressCode: string;
    costBearer: string;
    lendingHistory: string;
    notes: string;
    returnDate: string;
    status: DeviceStatus;
    contractStatus: string;
    contractYears?: string;
    employeeCode: string;
    version: number;
    updatedAt: string;
}
