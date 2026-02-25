
import type { Log } from './index';

// --- Dashboard Types ---

export interface KPIStats {
    todayActionCount: number;
    todayFailureCount: number;
    loginFailureCount24h: number; // Last 24 hours
    unacknowledgedAnomalyCount: number; // Phase 6-3
    adminActionCount: number; // CREATE/UPDATE/DELETE by admin
}

export interface DayStat {
    date: string; // YYYY-MM-DD
    count: number;
    failureCount: number;
    anomalyCount: number;
}

export interface ActorStat {
    name: string;
    code: string;
    count: number;
}

export interface ActionTypeStat {
    action: string;
    count: number;
    fill: string; // Color for charts
    [key: string]: any;
}

export interface SeverityStat {
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
    fill: string;
    [key: string]: any; // For Recharts compatibility
}

export interface DashboardData {
    kpi: KPIStats;
    trend: DayStat[];
    distribution: ActionTypeStat[];
    severityDistribution: SeverityStat[];
    recentAnomalies: Log[]; // Phase 6-7: NEW
    topActors: ActorStat[]; // Phase 6-7: NEW
    topAnomalyActors: ActorStat[]; // Phase 6-7: NEW
}

// --- Anomaly Detection Types ---

export type AnomalyType =
    | 'LOGIN_BRUTE_FORCE'
    | 'UNAUTHORIZED_ACTION'
    | 'BULK_UPDATE'
    | 'SUSPICIOUS_ACCESS';

export interface AnomalyEvent {
    type: AnomalyType;
    description: string;
    detectedAt: string; // ISO string
    relatedLogIds: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
