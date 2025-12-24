import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface AnomalyRule {
    id: string;
    rule_key: string;
    description: string;
    enabled: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    params: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

const supabase = createClientComponentClient();

export const auditService = {
    async fetchAnomalyRules(): Promise<AnomalyRule[]> {
        const { data, error } = await supabase
            .from('audit_anomaly_rules')
            .select('*')
            .order('rule_key', { ascending: true });

        if (error) {
            console.error('Failed to fetch anomaly rules:', JSON.stringify(error, null, 2));
            throw error;
        }

        return data as AnomalyRule[];
    },

    async updateAnomalyRule(id: string, updates: Partial<AnomalyRule>): Promise<void> {
        const { error } = await supabase
            .from('audit_anomaly_rules')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Failed to update anomaly rule:', error);
            throw error;
        }
    }
};
