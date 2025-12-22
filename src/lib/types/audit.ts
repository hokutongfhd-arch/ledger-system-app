
import type { Log } from './index';

// --- Dashboard Types ---

export interface KPIStats {
    todayActionCount: number;
    todayFailureCount: number;
    loginFailureCount24h: number; // Last 24 hours
    adminActionCount: number; // CREATE/UPDATE/DELETE by admin
}

export interface DayStat {
    date: string; // YYYY-MM-DD
    count: number;
}

export interface ActionTypeStat {
    action: string;
    count: number;
    fill: string; // Color for charts
    [key: string]: any;
}

export interface DashboardData {
    kpi: KPIStats;
    trend: DayStat[];
    distribution: ActionTypeStat[];
}

// --- Anomaly Detection Types ---

export type AnomalyType =
    | 'LOGIN_BRUTE_FORCE'
    | 'UNAUTHORIZED_ACTION'
    | 'BULK_UPDATE';

export interface AnomalyEvent {
    type: AnomalyType;
    description: string;
    detectedAt: string; // ISO string
    relatedLogIds: string[];
    riskLevel: 'high' | 'medium' | 'low';
}
