import { useState, useEffect, useMemo, useCallback } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface SortCriterion<T> {
    key: keyof T;
    order: SortOrder;
}

interface UseServerDataTableProps<T> {
    fetchData: (params: { page: number; pageSize: number; searchTerm: string; sortCriteria: SortCriterion<T>[] }) => Promise<{ data: any[]; totalCount: number }>;
    mapData: (dbItem: any) => T;
    initialPageSize?: number;
    debounceMs?: number;
}

export const useServerDataTable = <T extends { id: string }>({
    fetchData,
    mapData,
    initialPageSize = 15,
    debounceMs = 300
}: UseServerDataTableProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    const [sortCriteria, setSortCriteria] = useState<SortCriterion<T>[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const [paginatedData, setPaginatedData] = useState<T[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1); // Reset page on new search
        }, debounceMs);
        return () => clearTimeout(handler);
    }, [searchTerm, debounceMs]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchData({
                page: currentPage,
                pageSize,
                searchTerm: debouncedSearchTerm,
                sortCriteria
            });
            setPaginatedData(result.data.map(mapData));
            setTotalItems(result.totalCount);
        } catch (err: any) {
            console.error('Failed to load server data:', err);
            setError(err.message || 'データ取得エラー');
        } finally {
            setIsLoading(false);
        }
    }, [fetchData, mapData, currentPage, pageSize, debouncedSearchTerm, sortCriteria]);

    // Re-fetch when dependencies change
    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Adjust current page if out of bounds after deletion etc
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalItems, pageSize, currentPage, totalPages]);

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
            if (idx === -1) {
                // Return new array with this key as primary sort
                return [{ key, order: 'asc' }];
            }
            if (prev[idx].order === 'asc') {
                return [{ key, order: 'desc' }];
            }
            return []; // Unsort
        });
        setCurrentPage(1); // Reset page on sort
    };

    return {
        // State
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        pageSize, setPageSize,
        sortCriteria, setSortCriteria,
        selectedIds, setSelectedIds,
        isLoading,
        error,

        // Handlers
        toggleSort,
        handleCheckboxChange,
        handleSelectAll,
        refetch: loadData,

        // Data
        paginatedData,
        totalItems,
        totalPages,
        startIndex: (currentPage - 1) * pageSize,
        endIndex: Math.min(currentPage * pageSize, totalItems),
        isAllSelected,
    };
};
