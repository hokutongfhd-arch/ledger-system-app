'use server';

interface SlackPayload {
    text: string;
    blocks?: any[];
}

/**
 * Sends a notification to Slack via Incoming Webhook.
 * Defined as a Server Action to ensure secrecy of the Webhook URL.
 */
export async function sendSlackAlert(message: string, context?: any) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    // Safety fallback for dev/demo without webhook
    if (!webhookUrl) {
        console.log('---------------------------------------------------');
        console.log('[Slack Alert Mock] Webhook URL not configured.');
        console.log(`Message: ${message}`);
        if (context) {
            console.log('Context:', JSON.stringify(context, null, 2));
        }
        console.log('---------------------------------------------------');
        return { success: true, mocked: true };
    }

    try {
        const payload: SlackPayload = {
            text: message,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*🚨 Anomaly Detected*`
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${message}`
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Time:*\n${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Environment:*\n${process.env.NODE_ENV || 'development'}`
                        }
                    ]
                }
            ]
        };

        if (context) {
            payload.blocks?.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Details:*\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\``
                }
            });
        }

        // Add Link to Dashboard
        // NOTE: Replace with actual origin if available, or just relative path description
        const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/audit-dashboard`
            : 'Check Admin Dashboard';

        payload.blocks?.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View Audit Dashboard'
                    },
                    url: dashboardUrl.startsWith('http') ? dashboardUrl : 'http://localhost:3000/audit-dashboard'
                }
            ]
        });

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`[Slack Alert Error] Status: ${response.status}`);
            return { success: false, error: `Status ${response.status}` };
        }

        return { success: true };

    } catch (error: any) {
        console.error('[Slack Alert Failed]', error);
        return { success: false, error: error.message };
    }
}
