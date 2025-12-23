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
                                        <TableRow key={report.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedReport(report)}>
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
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground">Period</div>
                                    <div className="mt-1 font-mono text-sm">
                                        {new Date(selectedReport.period_start).toLocaleString()} <br />
                                        ↓ <br />
                                        {new Date(selectedReport.period_end).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg border bg-card">
                                    <div className="text-sm font-medium text-muted-foreground">Summary Stats</div>
                                    <div className="mt-1 space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span>Total Actions:</span>
                                            <span className="font-bold">{selectedReport.summary.total_actions}</span>
                                        </div>
                                        <div className="flex justify-between text-red-600">
                                            <span>Login Failures:</span>
                                            <span className="font-bold">{selectedReport.summary.login_failures}</span>
                                        </div>
                                        <div className="flex justify-between text-red-600">
                                            <span>Anomalies:</span>
                                            <span className="font-bold">{selectedReport.summary.anomalies}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-medium text-sm">Full Report JSON</h3>
                                <pre className="p-4 rounded-lg bg-slate-950 text-slate-50 overflow-x-auto text-xs font-mono">
                                    {JSON.stringify(selectedReport.summary, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
