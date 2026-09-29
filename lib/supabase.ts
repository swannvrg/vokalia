import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "atelier_session";
const SESSION_DAYS = 30;

export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [, salt, expected] = storedHash.split("$");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function authenticate(email: string, password: string) {
  const { data: user, error } = await createSupabaseAdminClient()
    .from("app_users")
    .select("id, email, password_hash, role, business_id, active")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error || !user?.active || !user.password_hash || !verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, email: user.email, role: user.role, business_id: user.business_id };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await createSupabaseAdminClient().from("app_sessions").insert({ user_id: userId, token_hash: tokenHash(token), expires_at: expiresAt });
  if (error) throw error;
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt) });
}

export async function createInvitationToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error } = await createSupabaseAdminClient().from("app_invitation_tokens").insert({ user_id: userId, token_hash: tokenHash(token), expires_at: expiresAt });
  if (error) throw error;
  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await createSupabaseAdminClient().from("app_sessions").delete().eq("token_hash", tokenHash(token));
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { data } = await createSupabaseAdminClient()
    .from("app_sessions")
    .select("expires_at, user:app_users(id, email, role, business_id, active)")
    .eq("token_hash", tokenHash(token))
    .maybeSingle();
  const user = Array.isArray(data?.user) ? data.user[0] : data?.user;
  if (!data || new Date(data.expires_at) <= new Date() || !user || !user.active) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return { supabase: createSupabaseAdminClient(), user };
}

type AppClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

export async function getBusinessIdForCurrentUser(supabase: AppClient, userId: string) {
  const { data: appUser } = await supabase.from("app_users").select("business_id").eq("id", userId).maybeSingle();
  if (appUser?.business_id) return appUser.business_id;
  const { data, error } = await supabase.from("businesses").select("id").eq("app_user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("NO_BUSINESS");
  return data.id;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

export async function resolveAuthorizedBusinessId(
  supabase: AppClient,
  user: { id: string; role?: string },
  requestedBusinessId?: string | null,
): Promise<string> {
  const ownBusinessId = await getBusinessIdForCurrentUser(supabase, user.id).catch(
    () => null,
  );

  // Cas utilisateur classique (coiffeur) :
  if (user.role !== "admin") {
    if (!ownBusinessId) {
      throw new Error("NO_BUSINESS");
    }
    // Protection anti-IDOR stricte : interdiction de manipuler un salon tiers
    if (requestedBusinessId && requestedBusinessId !== ownBusinessId) {
      throw new Error("FORBIDDEN");
    }
    return ownBusinessId;
  }

  // Cas administrateur :
  if (requestedBusinessId) {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", requestedBusinessId)
      .eq("status", "active")
      .maybeSingle();
    if (error || !business) throw new Error("SALON_NOT_FOUND");
    return business.id;
  }

  if (ownBusinessId) return ownBusinessId;
  throw new Error("NO_BUSINESS");
}
