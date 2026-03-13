import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Singleton Supabase Client for the browser context.
 * This prevents the "Multiple GoTrueClient instances detected" warning
 * and ensures that all components share the same Auth state and connection.
 */
let client: ReturnType<typeof createClientComponentClient> | null = null;

export const getSupabaseBrowserClient = () => {
    if (client) return client;

    client = createClientComponentClient();
    return client;
};
