import { useState, useCallback, useEffect } from 'react';
import { fetchOperationLogsServer } from './operationLogs.server';
import { getWeekRange } from '../../lib/utils/dateHelpers';
import type { OperationLog } from '../../lib/types';

export type OperationLogFilterState = {
    startDate: string;
    endDate: string;
    actor: string;
    operation: string;
    tableName: string;
};

export type OperationSortState = {
    field: 'created_at' | 'actor_name';
    order: 'asc' | 'desc';
};

const mapLogFromDb = (d: any): OperationLog => ({
    id: d.id,
    timestamp: d.created_at, // Use created_at as requested
    tableName: d.table_name,
    operation: d.operation,
    oldData: d.old_data,
    newData: d.new_data,
    actorName: d.actor_name,
    actorCode: d.actor_code,
    isArchived: d.is_archived,
    archivedAt: d.archived_at,
});

export const useOperationLogs = () => {
    const [logs, setLogs] = useState<OperationLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    const [pageSize, setPageSize] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);

    const { start, end } = getWeekRange(new Date());
    const [filters, setFilters] = useState<OperationLogFilterState>({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        actor: '',
        operation: '',
        tableName: ''
    });

    const [sort, setSort] = useState<OperationSortState>({
        field: 'created_at', // Default sort to created_at
        order: 'desc'
    });

    const [showArchived, setShowArchived] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { logs: data, total, error } = await fetchOperationLogsServer({
                page: currentPage,
                pageSize: pageSize,
                startDate: filters.startDate,
                endDate: filters.endDate,
                actor: filters.actor,
                operation: filters.operation,
                tableName: filters.tableName,
                sort: sort,
                includeArchived: showArchived
            });

            if (!error && data) {
                setLogs(data.map(mapLogFromDb));
                setTotalCount(total);
            }
        } catch (error) {
            console.error('Failed to fetch operation logs:', error);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, filters, sort, showArchived]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Reset dates when showArchived state changes
    useEffect(() => {
        const { start, end } = getWeekRange(new Date());
        if (!showArchived) {
            // "Active" mode: Fixed to this week
            updateFilter('startDate', start.toISOString());
            updateFilter('endDate', end.toISOString());
        } else {
            // "Archive" mode: Everything BEFORE this week's Sunday
            const dayBeforeSun = new Date(start);
            dayBeforeSun.setMilliseconds(-1);

            // Set end date to archive cutoff, and clear start date to show all history
            updateFilter('endDate', dayBeforeSun.toISOString());
            updateFilter('startDate', '');
        }
    }, [showArchived]);

    const updateFilter = (key: keyof OperationLogFilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleSort = (field: 'created_at' | 'actor_name') => {
        setSort(prev => ({
            field,
            order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    const fetchAllForExport = async () => {
        try {
            const { logs: allLogs } = await fetchOperationLogsServer({
                page: 1,
                pageSize: 5000,
                startDate: filters.startDate,
                endDate: filters.endDate,
                actor: filters.actor,
                operation: filters.operation,
                tableName: filters.tableName,
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
