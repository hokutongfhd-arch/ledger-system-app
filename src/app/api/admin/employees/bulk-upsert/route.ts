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

        // =========================================================
        // インポート前: メールアドレスの DB 重複チェック
        // 既に登録されているメールアドレスが含まれていればインポートを中止
        // =========================================================
        const importEmails = employees
            .filter((emp: any) => emp.email) // メールアドレスがある行のみ
            .map((emp: any) => ({ code: emp.employee_code, email: emp.email.trim().toLowerCase() }));

        if (importEmails.length > 0) {
            // DB に存在する全社員のメールアドレス一覧を事前取得
            const emailList = importEmails.map((e: any) => e.email);
            const { data: existingEmailRows, error: emailFetchError } = await supabaseAdmin
                .from('employees')
                .select('employee_code, name, email')
                .in('email', emailList);

            if (!emailFetchError && existingEmailRows && existingEmailRows.length > 0) {
                // 自分自身の上書き更新は除外して重複を判定
                const importCodes = new Set(employees.map((e: any) => e.employee_code));
                const duplicateErrors: string[] = [];

                existingEmailRows.forEach((row: any) => {
                    const isOwnUpdate = importCodes.has(row.employee_code);
                    if (!isOwnUpdate) {
                        // 既存の別社員のメールと重複
                        const importedRow = importEmails.find((e: any) =>
                            e.email === (row.email || '').toLowerCase()
                        );
                        if (importedRow) {
                            duplicateErrors.push(
                                `メールアドレス「${row.email}」は既に登録されています（登録済み社員: ${row.name || row.employee_code}）`
                            );
                        }
                    }
                });

                if (duplicateErrors.length > 0) {
                    return NextResponse.json({
                        success: false,
                        error: 'メールアドレスの重複が検出されたためインポートを中止しました',
                        duplicateErrors,
                        validationErrors: duplicateErrors,
                    }, { status: 400 });
                }
            }
        }

        const results = [];

        // Process sequentially to be safe (or Promise.all with concurrency limit if needed)
        // Sequential is safer for auth rate limits.
        for (const emp of employees) {
            // We pass 'actorUser' so that shared logic can patch the audit log after upsert
            const res = await upsertEmployeeLogic(supabaseAdmin, emp, actorUser);
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
