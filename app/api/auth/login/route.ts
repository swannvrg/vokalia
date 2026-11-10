import {
  authenticate,
  createSession,
  createSupabaseAdminClient,
  getBusinessIdForCurrentUser,
} from "@/lib/supabase";
import { isLoginRateLimited, recordFailedLogin } from "@/lib/login-rate-limit";
import { getRequestIp } from "@/lib/request-ip";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const rawPassword = String(password ?? "");
  // Entrées impossibles : refusées sans requête en base ni scrypt sur une entrée énorme.
  if (!normalizedEmail || normalizedEmail.length > 254 || rawPassword.length > 128) {
    return Response.json({ error: "Identifiants incorrects." }, { status: 401 });
  }
  const ip = getRequestIp(request);

  try {
    if (await isLoginRateLimited(normalizedEmail, ip)) {
      return Response.json(
        { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
        { status: 429 },
      );
    }
  } catch (error) {
    // Échec fermé : sans compteur fiable, on ne laisse pas passer d'essais illimités.
    console.error("[auth/login] Limite de tentatives indisponible :", error);
    return Response.json(
      { error: "Connexion momentanément indisponible. Réessayez plus tard." },
      { status: 503 },
    );
  }

  const user = await authenticate(normalizedEmail, rawPassword);
  if (!user) {
    try {
      await recordFailedLogin(normalizedEmail, ip);
    } catch (error) {
      console.error("[auth/login] Échec non enregistré :", error);
    }
    return Response.json({ error: "Identifiants incorrects." }, { status: 401 });
  }
  await createSession(user.id);

  let businessId: string | null = null;
  if (user.role !== "admin") {
    try {
      businessId = await getBusinessIdForCurrentUser(
        createSupabaseAdminClient(),
        user.id,
      );
    } catch {
      businessId = null;
    }
  }

  return Response.json({
    ok: true,
    role: user.role,
    businessId,
    mustChangePassword: Boolean(user.must_change_password),
    onboardingPending: Boolean(user.onboarding_pending),
  });
}
