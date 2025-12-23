import { NextRequest, NextResponse } from 'next/server';
import { sendDailyAuditReportToSlack } from '@/app/actions/auditReport';

export async function GET(request: NextRequest) {
    // 1. Security Check (Optional but recommended for Cron)
    // Vercel Cron sends specific headers, or we can use a custom secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // If CRON_SECRET is not set in env (e.g. dev), we might allow it or block it.
        // For safety, if secret is set and header doesn't match, block.
        if (process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const result = await sendDailyAuditReportToSlack();

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Unknown error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
