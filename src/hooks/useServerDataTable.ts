import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

export type SortOrder = 'asc' | 'desc';

export interface SortCriterion<T> {
    key: keyof T;
    order: SortOrder;
}

interface UseServerDataTableProps<T> {
    fetchData: (params: { page: number; pageSize: number; searchTerm: string; sortCriteria: SortCriterion<T>[]; highlightId?: string }) => Promise<{ data: any[]; totalCount: number; highlightPage?: number }>;
    mapData: (dbItem: any) => T;
    initialPageSize?: number;
    debounceMs?: number;
    highlightId?: string | null;
}

export const useServerDataTable = <T extends { id: string }>({
    fetchData,
    mapData,
    initialPageSize = 15,
    debounceMs = 300,
    highlightId,
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
    const [highlightHandled, setHighlightHandled] = useState(false);

    const isFirstRender = useRef(true);

    // Debounce search term
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1); // Reset page on new search
        }, debounceMs);
        return () => clearTimeout(handler);
    }, [searchTerm, debounceMs]);

    const loadData = useCallback(async () => {
        console.log('[useServerDataTable] loadData called', { currentPage, pageSize, searchTerm: debouncedSearchTerm, sortCriteria, highlightId, highlightHandled });
        setIsLoading(true);
        setError(null);
        try {
            const params: any = {
                page: currentPage,
                pageSize,
                searchTerm: debouncedSearchTerm,
                sortCriteria
            };
            
            if (highlightId && !highlightHandled) {
                params.highlightId = highlightId;
                console.log('[useServerDataTable] Requesting highlightPage for id:', highlightId);
            }

            const result = await fetchData(params);
            console.log('[useServerDataTable] Received result:', result);

            // Set totalItems FIRST so the boundary effect doesn't reset currentPage to 1
            setTotalItems(result.totalCount);

            if (result.highlightPage && result.highlightPage !== currentPage) {
                console.log('[useServerDataTable] Changing page to highlightPage:', result.highlightPage);
                setCurrentPage(result.highlightPage);
                setHighlightHandled(true);
                return; // Let the next effect run with the new page
            }

            console.log('[useServerDataTable] Setting paginated data. Items:', result.data.length);
            setPaginatedData(result.data.map(mapData));
            if (highlightId) {
                setHighlightHandled(true);
            }
        } catch (err: any) {
            console.error('[useServerDataTable] Failed to load server data:', err);
            setError(err.message || 'データ取得エラー');
        } finally {
            setIsLoading(false);
        }
    }, [fetchData, mapData, currentPage, pageSize, debouncedSearchTerm, sortCriteria, highlightId, highlightHandled]);

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
