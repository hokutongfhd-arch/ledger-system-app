import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { logger } from '../../lib/logger';

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
        // Fetch rule key first for better logging
        const { data: rule } = await supabase
            .from('audit_anomaly_rules')
            .select('rule_key')
            .eq('id', id)
            .single();

        const { error } = await supabase
            .from('audit_anomaly_rules')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Failed to update anomaly rule:', error);
            await logger.error({
                action: 'UPDATE',
                targetType: 'audit_rule',
                targetId: id,
                message: `不正検知ルール (${rule?.rule_key || id}) の更新に失敗しました`,
                metadata: { updates, error }
            });
            throw error;
        }

        // Success Log
        await logger.info({
            action: 'UPDATE',
            targetType: 'audit_rule',
            targetId: id,
            message: `不正検知ルール (${rule?.rule_key || id}) を更新しました`,
            metadata: { updates }
        });
    }
};
