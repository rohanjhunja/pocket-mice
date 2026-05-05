import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Only run middleware on routes that require session management.
     * Excluded (no middleware needed):
     *   - /join, /play  → student-facing public routes, no teacher session
     *   - /login, /auth → auth flow pages
     *   - _next/static, _next/image, favicon, static assets
     *
     * Included:
     *   - /dashboard and all sub-routes
     *   - /api routes
     */
    '/dashboard/:path*',
    '/api/:path*',
  ],
}
