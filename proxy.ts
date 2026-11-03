import { NextResponse, type NextRequest } from "next/server";

async function tokenHash(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("atelier_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const lookupUrl = new URL(`${supabaseUrl}/rest/v1/app_sessions`);
  lookupUrl.searchParams.set("select", "expires_at,user:app_users(id,role,business_id,active,must_change_password,onboarding_pending)");
  lookupUrl.searchParams.set("token_hash", `eq.${await tokenHash(token)}`);
  lookupUrl.searchParams.set("limit", "1");
  const lookup = await fetch(lookupUrl, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  const rows = lookup.ok ? await lookup.json() : [];
  const data = rows[0];
  const user = Array.isArray(data?.user) ? data.user[0] : data?.user;
  if (!data || new Date(data.expires_at) <= new Date() || !user || !user.active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isLogout = pathname === "/api/auth/logout";
  const passwordPage = pathname === "/bienvenue/mot-de-passe";
  const passwordApi = pathname === "/api/account/set-password";
  if (user.must_change_password && !passwordPage && !passwordApi && !isLogout) {
    if (isApi) {
      return NextResponse.json(
        { error: "Changement de mot de passe requis.", code: "MUST_CHANGE_PASSWORD" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/bienvenue/mot-de-passe", request.url));
  }

  const onboardingPage = Boolean(user.business_id) && pathname === `/${user.business_id}/onboarding`;
  const onboardingApi = pathname.startsWith("/api/onboarding/");
  const setupApi = [
    "/api/profile/business",
    "/api/profile/hours",
    "/api/profile/resources",
    "/api/profile/services",
    "/api/profile/services/default",
  ].some((path) => pathname === path);
  if (user.onboarding_pending && !onboardingPage && !onboardingApi && !setupApi && !isLogout) {
    if (isApi) {
      return NextResponse.json(
        { error: "Configuration du salon requise.", code: "ONBOARDING_REQUIRED" },
        { status: 403 },
      );
    }
    if (user.business_id) {
      return NextResponse.redirect(new URL(`/${user.business_id}/onboarding`, request.url));
    }
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!$|mentions-legales|login|prendre-rdv|demande-invitation|invitation|api/auth|api/public|api/invitations|api/callback-notify|sitemap.xml|robots.txt|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};