'use server';

interface SlackPayload {
    text: string;
    blocks?: any[];
}

interface AlertContext {
    anomalyType?: string;
    actor?: string;
    target?: string;
    occurredAt?: string;
    [key: string]: any; // Allow other properties
}

/**
 * Sends a notification to Slack via Incoming Webhook.
 * Defined as a Server Action to ensure secrecy of the Webhook URL.
 */
export async function sendSlackAlert(
    title: string,
    message: string,
    context?: AlertContext
) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    // Safety fallback for dev/demo without webhook
    if (!webhookUrl) {
        console.info('---------------------------------------------------');
        console.info('[Slack Mock] Webhook URL not configured.');
        console.info(`Title:   ${title}`);
        console.info(`Message: ${message}`);
        if (context) {
            console.info('Context:', JSON.stringify(context, null, 2));
        }
        console.info('---------------------------------------------------');
        return { success: true, mocked: true };
    }

    try {
        // Emoji mapping based on anomaly type
        let emoji = '🚨';
        if (context?.anomalyType === 'LOGIN_BRUTE_FORCE') emoji = '🔐';
        else if (context?.anomalyType === 'UNAUTHORIZED_ACTION') emoji = '⚠️';
        else if (context?.anomalyType === 'BULK_UPDATE') emoji = '📦';

        const payload: SlackPayload = {
            text: `${emoji} ${title}: ${message}`, // Fallback text
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: `${emoji} ${title}`,
                        emoji: true
                    }
                },
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: message
                    }
                },
                {
                    type: 'divider'
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Environment:*\n${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Time:*\n${context?.occurredAt || new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
                        }
                    ]
                }
            ]
        };

        if (context) {
            const details = [];
            if (context.actor) details.push(`*Actor:* ${context.actor}`);
            if (context.target) details.push(`*Target:* ${context.target}`);
            if (context.anomalyType) details.push(`*Type:* ${context.anomalyType}`);

            // Add other context fields if they exist and are not already handled
            const otherKeys = Object.keys(context).filter(k =>
                !['actor', 'target', 'anomalyType', 'occurredAt'].includes(k)
            );

            if (otherKeys.length > 0) {
                details.push(`*Other:* \`\`\`${JSON.stringify(Object.fromEntries(Object.entries(context).filter(([k]) => otherKeys.includes(k))), null, 2)}\`\`\``);
            }

            if (details.length > 0) {
                payload.blocks?.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: details.join('\n')
                    }
                });
            }
        }

        // Add Link to Dashboard
        const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/audit/dashboard`
            : 'http://localhost:3000/audit/dashboard';

        payload.blocks?.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View Dashboard',
                        emoji: true
                    },
                    url: dashboardUrl,
                    style: 'primary'
                }
            ]
        });

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`[Slack Alert Error] Status: ${response.status}, Body: ${body}`);
            return { success: false, error: `Status ${response.status}: ${body}` };
        }

        return { success: true };

    } catch (error: any) {
        console.error('[Slack Alert Failed]', error);
        return { success: false, error: error.message };
    }
}
