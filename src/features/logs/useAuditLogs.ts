import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { logService } from './log.service';
import type { Log } from '../../lib/types';
import { getWeekRange } from '../../lib/utils/dateHelpers';
import { fetchAuditLogsServer, submitAnomalyResponseServer, fetchAuditLogByIdServer } from './logs.server';
import { toast } from 'react-hot-toast';

export type LogFilterState = {
    startDate: string;
    endDate: string;
    actor: string;
    actionType: string;
    result: 'success' | 'failure' | '';
    target: string;
    responseStatus: 'all' | 'responded' | 'pending';
};

export type SortState = {
    field: 'occurred_at' | 'actor_name' | 'is_acknowledged';
    order: 'asc' | 'desc';
};

export const useAuditLogs = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Pagination
    const [pageSize, setPageSize] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);

    const searchParams = useSearchParams();

    // Filters
    const { start, end } = getWeekRange(new Date());
    const [filters, setFilters] = useState<LogFilterState>({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        actor: searchParams.get('actor') || '',
        actionType: searchParams.get('actionType') || '',
        result: '',
        target: searchParams.get('target') || '',
        responseStatus: 'all'
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
                responseStatus: filters.responseStatus,
                sort: sort,
                includeArchived: showArchived
            });

            if (error) {
                console.error('Server fetch error:', error);
                // Attempt to display a more user-friendly error if it's JSON
                let displayError = error;
                try {
                    // Try to parse if it looks like JSON
                    if (error.trim().startsWith('{')) {
                        const parsed = JSON.parse(error);
                        displayError = parsed.message || parsed.error || error;
                    } else {
                        displayError = error;
                    }
                } catch (e) {
                    // Not JSON, keep as is
                    displayError = error;
                }
                toast.error(`ログ取得エラー: ${displayError}`, { id: 'fetch-error' });
            }

            // Map server data (raw DB) to Log type using service mapper
            const mappedLogs = (data || []).map(logService.mapLogFromDb);
            setLogs(mappedLogs);
            setTotalCount(total);
        } catch (error: any) {
            console.error('Failed to fetch audit logs:', error);
            toast.error('監査ログの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, filters, sort, showArchived]);

    // Initial fetch
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

    const updateFilter = (key: keyof LogFilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1); // Reset page on filter change
    };

    const handleSort = (field: 'occurred_at' | 'actor_name' | 'is_acknowledged') => {
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
                responseStatus: filters.responseStatus,
                sort: sort,
                includeArchived: showArchived
            });
            return allLogs;
        } catch (error) {
            console.error('Export fetch failed', error);
            return [];
        }
    };

    const submitResponse = useCallback(async (logId: string, status: string, note: string, adminUserId: string) => {
        setLoading(true);
        try {
            const result = await submitAnomalyResponseServer({
                logId,
                status,
                note,
                adminUserId
            });
            if (result.success) {
                await fetchLogs();
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Failed to submit response:', error);
            return { success: false, error: '予期せぬエラーが発生しました' };
        } finally {
            setLoading(false);
        }
    }, [fetchLogs]);

    const [initialSelectedLog, setInitialSelectedLog] = useState<Log | null>(null);

    // Sync with URL parameters for external navigation
    useEffect(() => {
        const actor = searchParams.get('actor');
        const target = searchParams.get('target');
        const actionType = searchParams.get('actionType');
        const logId = searchParams.get('logId');

        if (actor || target || actionType) {
            setFilters(prev => ({
                ...prev,
                actor: actor ?? prev.actor,
                target: target ?? prev.target,
                actionType: actionType ?? prev.actionType
            }));
            // Reset to first page when filters change
            setCurrentPage(1);
        }

        if (logId) {
            fetchAuditLogByIdServer(logId).then(res => {
                if (res.log) {
                    setInitialSelectedLog(logService.mapLogFromDb(res.log));
                }
            });
        }
    }, [searchParams]);

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
        fetchAllForExport,
        submitResponse,
        initialSelectedLog,
        setInitialSelectedLog
    };
};
