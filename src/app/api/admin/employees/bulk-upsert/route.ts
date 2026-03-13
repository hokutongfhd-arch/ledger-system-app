import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { upsertEmployeeLogic } from '../shared';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error('Supabase Config Missing');

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

// モジュールレベルのキャッシュ（Vercel 等のサーバーレス環境でも、インスタンスが生きている間は有効）
let globalAuthCache: Map<string, string> | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10分間有効

async function getAuthCache(supabaseAdmin: any) {
    const now = Date.now();
    if (globalAuthCache && (now - lastCacheTime < CACHE_TTL)) {
        return globalAuthCache;
    }

    const cache = new Map<string, string>();
    let page = 1;
    while (true) {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) break;
        users.forEach((u: any) => {
            if (u.email) cache.set(u.email.toLowerCase(), u.id);
        });
        if (users.length < 1000) break;
        page++;
    }

    globalAuthCache = cache;
    lastCacheTime = now;
    return cache;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { employees } = body; // Array of employee objects

        if (!Array.isArray(employees)) {
            return NextResponse.json({ error: 'Invalid input: employees must be an array' }, { status: 400 });
        }

        const cookieStore = await cookies();
        // @ts-expect-error: cookieStore type mismatch
        const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
        // Retrieve session user to use as "Actor" for audit logs
        const { data: { session } } = await supabaseUser.auth.getSession();
        let actorUser = session?.user;

        // Fallback for Initial Setup Account
        if (!actorUser) {
            const isSetup = cookieStore.get('is_initial_setup')?.value === 'true';
            if (isSetup) {
                actorUser = {
                    id: 'INITIAL_SETUP_ACCOUNT',
                    email: 'setup_admin@system.local',
                    user_metadata: {
                        name: '初期セットアップアカウント',
                        employee_code: '999999'
                    },
                    app_metadata: { role: 'admin' },
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                } as any;
            } else {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Auth ユーザーキャッシュの取得（パフォーマンス最適化）
        const authCache = await getAuthCache(supabaseAdmin);

        // =========================================================
        // インポート直前: 重複チェックの厳格化
        // =========================================================
        const importEmails = employees
            .filter((emp: any) => emp.email)
            .map((emp: any) => ({ code: String(emp.employee_code).trim(), email: String(emp.email).trim().toLowerCase() }));
        const importCodes = employees.map((emp: any) => String(emp.employee_code).trim());

        if (importEmails.length > 0) {
            const emailList = importEmails.map((e: any) => e.email);
            const { data: existingRows, error: fetchError } = await supabaseAdmin
                .from('employees')
                .select('employee_code, name, email')
                .or(`email.in.(${emailList.map(e => `"${e}"`).join(',')}),employee_code.in.(${importCodes.map(c => `"${c}"`).join(',')})`);

            if (!fetchError && existingRows && existingRows.length > 0) {
                const duplicateErrors: string[] = existingRows.map((row: any) => {
                    return `データ競合: ${row.name || row.employee_code} (コード: ${row.employee_code}) は既に登録されています。`;
                });

                return NextResponse.json({
                    success: false,
                    error: '登録済みのデータが検出されたためインポートを中止しました',
                    duplicateErrors,
                    validationErrors: duplicateErrors,
                }, { status: 400 });
            }
        }

        const results = [];

        // Process sequentially to be safe
        for (const emp of employees) {
            const res = await upsertEmployeeLogic(supabaseAdmin, emp, actorUser, authCache, 'strict');
            results.push(res);
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return NextResponse.json({
            success: true,
            processed: results.length,
            successCount,
            failureCount,
            results
        });

    } catch (error: any) {
        console.error('Bulk Upsert Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
