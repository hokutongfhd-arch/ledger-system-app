import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabase as staticSupabase } from './supabaseClient';

interface SystemErrorLogEntry {
    errorMessage: string;
    errorDetails?: any;
    context: string;
    userId?: string;
}

export const logSystemError = async (entry: SystemErrorLogEntry) => {
    try {
        // Use client component client if in browser, otherwise fallback to static client
        const supabase = typeof window !== 'undefined' ? createClientComponentClient() : staticSupabase;

        // Try to get the current user ID if not provided
        let userId = entry.userId;
        if (!userId) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                userId = session.user.id;
            }
        }

        // Prepare the details payload (convert objects to string for TEXT column)
        const detailsString = entry.errorDetails 
            ? (typeof entry.errorDetails === 'string' ? entry.errorDetails : JSON.stringify(entry.errorDetails, Object.getOwnPropertyNames(entry.errorDetails)))
            : null;

        const payload = {
            error_message: entry.errorMessage,
            error_details: detailsString,
            context: entry.context,
            user_id: userId || null,
        };

        const { error } = await supabase.from('system_error_logs').insert(payload);

        if (error) {
            console.error('Failed to write to system_error_logs:', error);
        }
    } catch (err) {
        // We catch everything here because a logging utility should never crash the main application
        console.error('Unexpected error in logSystemError:', err);
    }
};
