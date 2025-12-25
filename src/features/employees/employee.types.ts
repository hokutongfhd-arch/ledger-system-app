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
    authId?: string;
}

export interface Memo {
    id: number;
    employee_code: string;
    memo: string;
    created_at?: string;
}
