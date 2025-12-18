export interface Log {
    id: string;
    timestamp: string;
    user: string;
    target: string;
    action: 'add' | 'update' | 'delete' | 'import';
    details: string;
}
