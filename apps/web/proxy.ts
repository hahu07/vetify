import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Root auth gate (replaces app.ts's blanket requireAuth() mount from the
// Express backend) -- runs server-side before any page code executes,
// stronger than the old client-side-only ProtectedRoute guard per
// web2-migration-design.md §4. Full JWT verification (not just cookie
// presence) happens in getSession()/requireSession() on the API routes and
// in each page's server component -- this only short-circuits the obvious
// "no cookie at all" case before rendering.
//
// Named `proxy` (not `middleware`) per Next.js 16's renamed file convention.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/business/:path*", "/vetify/:path*"],
};
