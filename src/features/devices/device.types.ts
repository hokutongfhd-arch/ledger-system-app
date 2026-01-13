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
    employeeId: string;

    addressCode: string;
    smartAddressId: string;
    smartAddressPw: string;
    lendDate: string;
    receiptDate: string;
    notes: string;
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
    notes: string;
    returnDate: string;
    modelName: string;
    status: DeviceStatus;
    contractYears?: string;
}

export interface Router {
    id: string;
    no: string;
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
    company: string;
    addressCode: string;
    actualLender: string;
    costBearer: string;
    actualLenderName: string;
    lendingHistory: string;
    notes: string;
    returnDate: string;
    status: DeviceStatus;
    contractStatus: string;
    contractYears?: string;
    employeeCode: string;
}
