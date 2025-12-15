import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Memo } from '../types';

export const useMemos = (employeeCode: string) => {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchMemos = useCallback(async () => {
        if (!employeeCode) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('memos')
                .select('*')
                .eq('employee_code', employeeCode)
                .order('id', { ascending: false }); // Show newest first? User didn't specify, but usually desirable. Or maybe created_at desc? ID desc is usually same order.

            if (error) throw error;
            if (data) {
                setMemos(data as Memo[]);
            }
        } catch (error) {
            console.error('Failed to fetch memos:', error);
        } finally {
            setLoading(false);
        }
    }, [employeeCode]);

    useEffect(() => {
        fetchMemos();
    }, [fetchMemos]);

    const addMemo = async (text: string) => {
        if (!text.trim() || !employeeCode) return;
        try {
            const { data, error } = await supabase
                .from('memos')
                .insert({ employee_code: employeeCode, memo: text })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                setMemos(prev => [data as Memo, ...prev]);
            }
            return true;
        } catch (error) {
            console.error('Failed to add memo:', error);
            return false;
        }
    };

    const deleteMemo = async (id: number) => {
        try {
            const { error } = await supabase
                .from('memos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMemos(prev => prev.filter(m => m.id !== id));
            return true;
        } catch (error) {
            console.error('Failed to delete memo:', error);
            return false;
        }
    };

    return {
        memos,
        loading,
        addMemo,
        deleteMemo,
        refreshMemos: fetchMemos
    };
};
