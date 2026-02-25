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
    role: 'admin' | 'user';
    profileImage?: string;
    authId?: string;
    version: number;
    updatedAt: string;
}

export interface EmployeeInput extends Omit<Employee, 'id'> {
    password?: string;
}

export interface Memo {
    id: number;
    employee_code: string;
    memo: string;
    created_at?: string;
}
