export interface ManualFile {
    name: string;
    url: string;
}

export interface ManualItem {
    id: string;
    title: string;
    files: ManualFile[];
    updatedAt: string;
}

export interface TitleFragment {
    id: string;
    itemId: string;
    title: string;
    files: Array<ManualFile & { originalIndex: number; parentId?: string }>;
    updatedAt: string;
}
