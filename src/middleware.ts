import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareSupabaseClient({ req, res });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    // Check auth status
    // If not authenticated and trying to access protected routes, redirect to login
    if (!session && req.nextUrl.pathname !== '/login') {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = '/login';
        return NextResponse.redirect(redirectUrl);
    }

    // If authenticated and trying to access login, redirect to home (or user dashboard)
    if (session && req.nextUrl.pathname === '/login') {
        const redirectUrl = req.nextUrl.clone();
        // Determine where to redirect based on user role if possible, or just default to /
        // For now default to / (admin dashboard)
        redirectUrl.pathname = '/';
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes - assuming API handles its own auth or is public)
         */
        '/((?!_next/static|_next/image|favicon.ico|api).*)',
    ],
};
