import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const TABLE_LABEL: Record<string, string> = {
    employees: '社員マスタ',
    areas: 'エリアマスタ',
    addresses: '事業所マスタ',
    iphones: 'iPhone',
    tablets: '勤怠タブレット',
    routers: 'モバイルルーター',
    featurephones: 'ガラホ',
};

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase Config Missing');
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

/**
 * インポート操作のログをまとめる API。
 * Body: { tableName, startTime, successCount, actorName, actorCode }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tableName, startTime, successCount, actorName, actorCode } = body;

        if (!tableName || !startTime || successCount == null) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-expect-error: cookieStore type mismatch
        const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
        const { data: { session } } = await supabaseUser.auth.getSession();

        if (!session) {
            const isSetup = cookieStore.get('is_initial_setup')?.value === 'true';
            if (!isSetup) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabaseAdmin = getSupabaseAdmin();
        const label = TABLE_LABEL[tableName] || tableName;

        // 1. インポート開始時刻以降に自動生成されたINSERTトリガーログを削除
        await supabaseAdmin
            .from('logs')
            .delete()
            .eq('table_name', tableName)
            .eq('operation', 'INSERT')
            .gte('created_at', startTime);

        // 2. 1件のまとめログを INSERT
        if (successCount > 0) {
            await supabaseAdmin
                .from('logs')
                .insert({
                    table_name: tableName,
                    operation: 'IMPORT',
                    actor_name: actorName || '不明',
                    actor_code: actorCode || '',
                    new_data: {
                        count: successCount,
                        action: 'import',
                        message: `${successCount}件 インポート (${label})`,
                    },
                    old_data: null,
                });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Import Summary Log Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
