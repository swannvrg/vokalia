import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("atelier_session");
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!$|mentions-legales|login|prendre-rdv|demande-invitation|invitation|api/auth|api/public|api/invitations|api/callback-notify|sitemap.xml|robots.txt|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};