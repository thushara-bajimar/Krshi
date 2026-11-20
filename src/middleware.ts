import { NextResponse, type NextRequest } from "next/server";

// Cheap edge check: redirect to /login when there is no session cookie. Real validation happens server-side.
export function middleware(req: NextRequest) {
  const hasSession = !!req.cookies.get("krishi_session")?.value;
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/app") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/login", "/register"] };
