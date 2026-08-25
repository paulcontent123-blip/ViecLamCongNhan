import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-session";
import { EMPLOYER_SESSION_COOKIE, verifyEmployerSessionToken } from "@/lib/employer-session";
import { ROUTES } from "@/lib/routes";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== ROUTES.adminLogin) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL(ROUTES.adminLogin, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith(ROUTES.ntdDashboard)) {
    const token = request.cookies.get(EMPLOYER_SESSION_COOKIE)?.value;
    const session = token ? await verifyEmployerSessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL(ROUTES.ntdLogin, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tuyen-dung/dashboard/:path*"],
};
