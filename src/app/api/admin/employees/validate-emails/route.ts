import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

        const supabaseAdmin = getSupabaseAdmin();

        // =========================================================
        // インポート対象全件のメールアドレスの DB 重複チェック
        // =========================================================
        const importEmails = employees
            .filter((emp: any) => emp.email) // メールアドレスがある行のみ
            .map((emp: any) => ({ code: String(emp.employee_code).trim(), email: String(emp.email).trim().toLowerCase() }));

        if (importEmails.length === 0) {
            return NextResponse.json({ success: true });
        }

        const emailList = importEmails.map((e: any) => e.email);
        
        // Supabase の .in() クエリが URL 長の上限エラー (414) になるのを防ぐため 100件ずつ分割して取得
        const CHUNK_SIZE = 100;
        let existingEmailRows: any[] = [];
        let emailFetchError: any = null;

        for (let i = 0; i < emailList.length; i += CHUNK_SIZE) {
            const chunk = emailList.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabaseAdmin
                .from('employees')
                .select('employee_code, name, email')
                .in('email', chunk);
            
            if (error) {
                emailFetchError = error;
                break;
            }
            if (data) existingEmailRows.push(...data);
        }

        if (emailFetchError) {
             console.error('Email validation fetch error:', emailFetchError);
             return NextResponse.json({ error: 'Failed to validate emails' }, { status: 500 });
        }

        if (existingEmailRows && existingEmailRows.length > 0) {
            // 自分自身の上書き更新は除外して重複を判定
            const importCodes = new Set(employees.map((e: any) => String(e.employee_code).trim()));
            const duplicateErrors: string[] = [];

            existingEmailRows.forEach((row: any) => {
                const dbCode = String(row.employee_code).trim();
                const isOwnUpdate = importCodes.has(dbCode);
                
                if (!isOwnUpdate) {
                    // 既存の別社員のメールと重複している
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

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Email Validation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
