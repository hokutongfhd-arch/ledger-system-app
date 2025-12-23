import { useState, useCallback, useEffect } from 'react';
import { logService } from './log.service';
import type { Log } from '../../lib/types';
import { getWeekRange } from '../../lib/utils/dateHelpers';
import { fetchAuditLogsServer } from './logs.server';

export type LogFilterState = {
    startDate: string;
    endDate: string;
    actor: string;
    actionType: string;
    result: 'success' | 'failure' | '';
    target: string;
};

export type SortState = {
    field: 'occurred_at' | 'actor_name';
    order: 'asc' | 'desc';
};

export const useAuditLogs = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Pagination
    const [pageSize, setPageSize] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);

    // Filters
    // Remove default date restriction to ensure logs are visible by default
    const [filters, setFilters] = useState<LogFilterState>({
        startDate: '',
        endDate: '',
        actor: '',
        actionType: '',
        result: '',
        target: ''
    });

    // Sort
    const [sort, setSort] = useState<SortState>({
        field: 'occurred_at',
        order: 'desc'
    });



    // Archive Toggle
    const [showArchived, setShowArchived] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { logs: data, total, error } = await fetchAuditLogsServer({
                page: currentPage,
                pageSize: pageSize,
                startDate: filters.startDate,
                endDate: filters.endDate,
                actor: filters.actor,
                actionType: filters.actionType,
                result: filters.result === '' ? undefined : filters.result,
                target: filters.target,
                sort: sort,
                includeArchived: showArchived
            });

            if (error) {
                console.error('Server fetch error:', error);
            }

            // Map server data (raw DB) to Log type using service mapper
            const mappedLogs = (data || []).map(logService.mapLogFromDb);
            setLogs(mappedLogs);
            setTotalCount(total);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            // In a real app, you might expose an error state
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, filters, sort, showArchived]);

    // Initial fetch
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const updateFilter = (key: keyof LogFilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1); // Reset page on filter change
    };

    const handleSort = (field: 'occurred_at' | 'actor_name') => {
        setSort(prev => ({
            field,
            order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    // CSV Export Helper
    const fetchAllForExport = async () => {
        try {
            // Fetch all matching records (without pagination ideally, or large limit)
            // Note: For large datasets, you might need a dedicated export endpoint or looped fetching.
            // Here we assume a reasonable limit for CSV e.g. 1000 or using a large page size.
            const { logs: allLogs } = await fetchAuditLogsServer({
                page: 1,
                pageSize: 5000, // Hard cap for safety
                startDate: filters.startDate,
                endDate: filters.endDate,
                actor: filters.actor,
                actionType: filters.actionType,
                result: filters.result === '' ? undefined : filters.result,
                target: filters.target,
                sort: sort,
                includeArchived: showArchived
            });
            return allLogs;
        } catch (error) {
            console.error('Export fetch failed', error);
            return [];
        }
    };

    return {
        logs,
        loading,
        totalCount,
        currentPage,
        pageSize,
        filters,
        sort,
        showArchived,
        setShowArchived,
        setPageSize,
        setCurrentPage,
        updateFilter,
        handleSort,
        refresh: fetchLogs,
        fetchAllForExport
    };
};
