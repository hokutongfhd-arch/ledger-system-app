import { useState, useEffect, useMemo } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface SortCriterion<T> {
    key: keyof T;
    order: SortOrder;
}

interface UseDataTableProps<T> {
    data: T[];
    initialPageSize?: number;
    searchKeys?: (keyof T)[];
    filterFn?: (item: T, term: string) => boolean;
    sortConfig?: {
        [key in keyof T]?: (a: T, b: T) => number;
    };
}

export const useDataTable = <T extends { id: string }>({
    data,
    initialPageSize = 15,
    searchKeys,
    filterFn,
    sortConfig
}: UseDataTableProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [sortCriteria, setSortCriteria] = useState<SortCriterion<T>[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filter
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const lowerTerm = searchTerm.toLowerCase();

        return data.filter(item => {
            if (filterFn) return filterFn(item, lowerTerm);
            if (searchKeys) {
                return searchKeys.some(key =>
                    String(item[key] || '').toLowerCase().includes(lowerTerm)
                );
            }
            // Default: search all string/number values
            return Object.values(item).some(val =>
                String(val || '').toLowerCase().includes(lowerTerm)
            );
        });
    }, [data, searchTerm, searchKeys, filterFn]);

    // Sort
    const sortedData = useMemo(() => {
        if (sortCriteria.length === 0) return filteredData;

        return [...filteredData].sort((a, b) => {
            for (const criterion of sortCriteria) {
                const { key, order } = criterion;

                if (sortConfig && sortConfig[key]) {
                    const comparison = sortConfig[key]!(a, b);
                    if (comparison !== 0) {
                        return order === 'asc' ? comparison : -comparison;
                    }
                    continue;
                }

                const valA = a[key] as any;
                const valB = b[key] as any;

                if (valA === valB) continue;

                // Handle number-like strings or pure numbers
                const isNumA = !isNaN(Number(valA));
                const isNumB = !isNaN(Number(valB));

                if (isNumA && isNumB) {
                    const numA = Number(valA);
                    const numB = Number(valB);
                    return order === 'asc' ? numA - numB : numB - numA;
                }

                const strA = String(valA || '');
                const strB = String(valB || '');

                const comparison = strA.localeCompare(strB);
                if (comparison !== 0) {
                    return order === 'asc' ? comparison : -comparison;
                }
            }
            return 0;
        });
    }, [filteredData, sortCriteria, sortConfig]);

    // Pagination
    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // Adjust current page if out of bounds
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        } else if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [totalItems, pageSize, currentPage, totalPages]);

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedData = sortedData.slice(startIndex, endIndex);

    // Selection
    const handleCheckboxChange = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            paginatedData.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    };

    const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedIds.has(item.id));

    // Sort Handlers
    const toggleSort = (key: keyof T) => {
        setSortCriteria(prev => {
            const idx = prev.findIndex(c => c.key === key);
            if (idx === -1) return [...prev, { key, order: 'asc' }];
            if (prev[idx].order === 'asc') {
                const next = [...prev];
                next[idx] = { ...next[idx], order: 'desc' };
                return next;
            }
            return prev.filter(c => c.key !== key);
        });
    };

    return {
        // State
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, setSortCriteria,
        selectedIds, setSelectedIds,

        // Handlers
        toggleSort,
        handleCheckboxChange,
        handleSelectAll,

        // Data
        paginatedData,
        filteredData,
        sortedData,
        totalItems,
        totalPages,
        startIndex,
        endIndex,
        isAllSelected,
    };
};
