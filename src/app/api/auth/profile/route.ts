import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Service Role Client for linking logic
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('[Profile API] Critical: Missing Supabase Config. URL:', !!url, 'Key:', !!key);
        throw new Error('Missing Supabase Config');
    }
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        // @ts-expect-error: Next.js 15+ cookies() is async, but auth-helpers expects sync or compatible types
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

        // 1. Verify Session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = getSupabaseAdmin();
        const authId = session.user.id;

        // 2. Try Fetch by auth_id (Primary)
        const { data: linkedEmployee } = await admin
            .from('employees')
            .select('*')
            .eq('auth_id', authId)
            .single();

        if (linkedEmployee) {
            return NextResponse.json({ employee: linkedEmployee });
        }

        // 3. Fallback: Identify by Employee Code
        // Attempt to get code from Request Body (passed from Login) or Metadata
        let employeeCode = session.user.user_metadata?.employee_code;

        if (!employeeCode) {
            // Check body if metadata misses it
            try {
                const body = await req.json();
                if (body.employeeCode) employeeCode = body.employeeCode;
            } catch (e) {
                // Ignore json parse error
            }
        }

        if (!employeeCode) {
            return NextResponse.json({ error: 'Cannot identify employee' }, { status: 404 });
        }

        // 4. Find Unlinked Employee
        const { data: candidate, error: searchError } = await admin
            .from('employees')
            .select('*')
            .eq('employee_code', employeeCode)
            .single();

        if (candidate) {
            // Check if already taken? (Should limit to where auth_id IS NULL for safety?)
            // For now, we assume if we found it and we are authenticated as this user (by code inference), we link.
            // But safety check: if candidate.auth_id exists and is NOT us, that's a conflict.
            if (candidate.auth_id && candidate.auth_id !== authId) {
                // Security Check: Allow re-linking ONLY if the authenticated user's email matches the employee code
                // This handles the case where a Supabase User was deleted and recreated (new auth_id) but the DB link is stale.
                const emailPrefix = session.user.email?.split('@')[0];
                if (emailPrefix && String(candidate.employee_code) === emailPrefix) {
                    console.log(`[Profile API] Re-linking employee ${candidate.employee_code} to new auth_id ${authId} (Prev: ${candidate.auth_id})`);
                } else {
                    return NextResponse.json({ error: 'Employee code already linked to another user' }, { status: 409 });
                }
            }

            // LINK IT
            await admin
                .from('employees')
                .update({ auth_id: authId })
                .eq('id', candidate.id);

            // Return updated
            return NextResponse.json({ employee: { ...candidate, auth_id: authId } });
        }

        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    } catch (error: any) {
        console.error('Profile API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
