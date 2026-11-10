import { hashPassword, requireUser, revokeUserSessions, verifyPassword } from "@/lib/supabase";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user.must_change_password) {
      return Response.json({ error: "Ce changement n'est plus requis." }, { status: 400 });
    }
    const body = await request.json();
    const password = String(body.password ?? "");
    if (!isStrongPassword(password)) {
      return Response.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
    }
    const { data: current, error: currentError } = await supabase
      .from("app_users")
      .select("password_hash")
      .eq("id", user.id)
      .eq("must_change_password", true)
      .single();
    if (currentError || !current?.password_hash) throw currentError || new Error("PASSWORD_NOT_FOUND");
    if (verifyPassword(password, current.password_hash)) {
      return Response.json({ error: "Choisissez un mot de passe différent du mot de passe provisoire." }, { status: 400 });
    }
    const { error } = await supabase
      .from("app_users")
      .update({ password_hash: hashPassword(password), must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("must_change_password", true);
    if (error) throw error;
    // Les sessions ouvertes avec le mot de passe provisoire ailleurs sont coupées.
    try {
      await revokeUserSessions(user.id, { keepCurrent: true });
    } catch (revokeError) {
      console.error("[account/set-password] Révocation des sessions impossible :", revokeError);
      return Response.json(
        { error: "Mot de passe modifié, mais la déconnexion des autres appareils a échoué. Réessayez plus tard." },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, businessId: user.business_id, onboardingPending: Boolean(user.onboarding_pending) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    console.error("[account/set-password] Échec :", error instanceof Error ? error.message : "erreur inconnue");
    return Response.json({ error: "Impossible d'enregistrer le mot de passe." }, { status: 500 });
  }
}
