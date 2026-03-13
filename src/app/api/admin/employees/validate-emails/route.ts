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
        const codeList = importEmails.map((e: any) => e.code);
        
        // 分割して取得
        const CHUNK_SIZE = 100;
        let existingRows: any[] = [];
        let fetchError: any = null;

        // 1. メールアドレスの重複チェック
        for (let i = 0; i < emailList.length; i += CHUNK_SIZE) {
            const chunk = emailList.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabaseAdmin
                .from('employees')
                .select('employee_code, name, email')
                .in('email', chunk);
            
            if (error) { fetchError = error; break; }
            if (data) existingRows.push(...data.map(r => ({ ...r, conflictType: 'email' })));
        }

        // 2. 社員コードの重複チェック
        if (!fetchError) {
            for (let i = 0; i < codeList.length; i += CHUNK_SIZE) {
                const chunk = codeList.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabaseAdmin
                    .from('employees')
                    .select('employee_code, name, email')
                    .in('employee_code', chunk);
                
                if (error) { fetchError = error; break; }
                if (data) {
                    // メール重複で既に取得済みの行と重なる可能性があるため、マージ
                    data.forEach(r => {
                        if (!existingRows.find(ex => ex.employee_code === r.employee_code)) {
                            existingRows.push({ ...r, conflictType: 'code' });
                        }
                    });
                }
            }
        }

        if (fetchError) {
             console.error('Validation fetch error:', fetchError);
             return NextResponse.json({ error: 'Failed to validate employees' }, { status: 500 });
        }

        if (existingRows.length > 0) {
            // 誰の重複であってもエラーとする（厳格モード）
            const duplicateErrors: string[] = existingRows.map((row: any) => {
                if (row.conflictType === 'email') {
                    return `メールアドレス「${row.email}」は既に登録されています（登録済み社員: ${row.name || row.employee_code}）`;
                } else {
                    return `社員コード「${row.employee_code}」は既に登録されています（登録済み社員: ${row.name || row.employee_code}）`;
                }
            });

            return NextResponse.json({
                success: false,
                error: '既に登録済みのデータが検出されたためインポートを中止しました',
                duplicateErrors,
                validationErrors: duplicateErrors,
            }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Email Validation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
