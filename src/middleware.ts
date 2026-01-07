import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareSupabaseClient({ req, res });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    const path = req.nextUrl.pathname;

    // 1. Setup Account Check
    const isSetup = req.cookies.get('is_initial_setup')?.value === 'true';

    if (isSetup) {
        // Initial setup account can ONLY access employee master
        // Exempt public paths
        if (path === '/login' || path.startsWith('/_next') || path.startsWith('/api/auth')) {
            return res;
        }

        // Allow ONLY /masters/employees
        if (path === '/masters/employees') {
            return res;
        }

        // Otherwise, redirect to employee master
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/masters/employees';
        return NextResponse.redirect(redirectUrl);
    }

    // 2. Auth Check: If no session, redirect to login
    // Exempt public paths: login, api (if public), etc.
    if (!session) {
        if (path === '/login' || path.startsWith('/_next') || path.startsWith('/api/auth')) {
            return res;
        }
        // Redirect to login
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/login';
        return NextResponse.redirect(redirectUrl);
    }

    // 2. Role Check from App Metadata
    // Default to 'user' if not set
    const role = session.user.app_metadata.role || 'user';

    // 3. Admin Area Protection
    // Paths that require Admin: /(admin) -> usually mapped to /, /masters, /devices, /logs
    // We explicitly list paths or check pattern.
    // Based on file structure: 
    // Admin: /, /masters/*, /devices/*, /logs, /design-preview
    // User: /user-dashboard, /dashboard (if exists in user group)

    // Define strict Admin Paths (only for admin)
    const isStrictAdminPath =
        path === '/' ||
        path.startsWith('/logs') ||
        path.startsWith('/audit') ||
        path.startsWith('/audit-dashboard') ||
        path.startsWith('/masters') ||
        path.startsWith('/admin');

    if (isStrictAdminPath && role !== 'admin') {
        // Redirect unauthorized user to user dashboard
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/dashboard';
        return NextResponse.redirect(redirectUrl);
    }

    // 4. User Area Protection (Optional: Prevent Admin from seeing User dashboard? Usually Admin can see all, but maybe redirect to Admin Dash)
    // If Admin goes to /user-dashboard, maybe redirect to /? 
    // For now, let's keep it simple: Admins can access everything, OR stricter separation.
    // User request said: "user ブロック" -> Users implies blocking regular users from admin. 
    // "admin 専用ページ制御" -> Admin pages controlled.
    // Let's stick to blocking Users from Admin pages.

    // 5. Already Logged In -> Login Page Access
    if (path === '/login') {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = role === 'admin' ? '/' : '/dashboard';
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
};
