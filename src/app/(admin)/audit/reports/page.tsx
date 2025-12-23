'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AuditReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table-components';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../../../../components/ui/dialog";

import Link from 'next/link';

export default function AuditReportsPage() {
    const [reports, setReports] = useState<AuditReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
    const supabase = createClientComponentClient();

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_reports')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Audit Reports</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Daily & Weekly Reports</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date (Period Start)</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Total Actions</TableHead>
                                    <TableHead>Anomalies</TableHead>
                                    <TableHead>Generated At</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reports.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                            No reports found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reports.map((report) => (
                                        <TableRow
                                            key={report.id}
                                            className={`hover:bg-muted/50 cursor-pointer ${report.summary.anomalies > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                            onClick={() => setSelectedReport(report)}
                                        >
                                            <TableCell className="font-medium">
                                                {new Date(report.period_start).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${report.report_type === 'weekly'
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                    }`}>
                                                    {report.report_type}
                                                </span>
                                            </TableCell>
                                            <TableCell>{report.summary.total_actions}</TableCell>
                                            <TableCell>
                                                {report.summary.anomalies > 0 ? (
                                                    <span className="text-red-600 font-bold flex items-center gap-1">
                                                        {report.summary.anomalies}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(report.created_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedReport(report);
                                                }}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Report Detail: {selectedReport && new Date(selectedReport.period_start).toLocaleDateString()}</DialogTitle>
                    </DialogHeader>
                    {selectedReport && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Period Info</div>
                                    <div className="font-mono text-sm space-y-1">
                                        <div className="flex justify-between">
                                            <span>Start:</span>
                                            <span>{new Date(selectedReport.period_start).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>End:</span>
                                            <span>{new Date(selectedReport.period_end).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <Link href={`/logs?startDate=${selectedReport.period_start}&endDate=${selectedReport.period_end}`} passHref>
                                            <Button size="sm" variant="outline" className="w-full">
                                                View Logs for this Period
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Summary Stats</div>
                                    <div className="mt-1 space-y-2 text-sm">
                                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                                            <span>Total Actions</span>
                                            <span className="font-bold text-lg">{selectedReport.summary.total_actions}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/10 rounded text-red-600">
                                            <span>Login Failures</span>
                                            <span className="font-bold text-lg">{selectedReport.summary.login_failures}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/10 rounded text-red-600">
                                            <span>Anomalies</span>
                                            <span className="font-bold text-lg">{selectedReport.summary.anomalies}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Breakdown by Action</div>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {Object.entries(selectedReport.summary.breakdown_by_action || {}).map(([action, count]) => (
                                            <div key={action} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                                                <span>{action}</span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Breakdown by Result</div>
                                    <div className="space-y-1">
                                        {Object.entries(selectedReport.summary.breakdown_by_result || {}).map(([result, count]) => (
                                            <div key={result} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                                                <span className={result === 'failure' ? 'text-red-600' : 'text-green-600'}>
                                                    {result}
                                                </span>
                                                <span className="font-mono font-medium">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t">
                                <details className="text-sm text-muted-foreground cursor-pointer">
                                    <summary className="hover:text-foreground transition-colors p-2 font-medium">
                                        Show Raw JSON Data
                                    </summary>
                                    <pre className="mt-2 p-4 rounded-lg bg-slate-950 text-slate-50 overflow-x-auto text-xs font-mono">
                                        {JSON.stringify(selectedReport.summary, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
