import { hashPassword, requireUser, revokeUserSessions, verifyPassword } from "@/lib/supabase";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!isStrongPassword(newPassword)) return Response.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
    const { data: stored } = await supabase.from("app_users").select("password_hash").eq("id", user.id).single();
    if (!stored?.password_hash || !verifyPassword(currentPassword, stored.password_hash)) return Response.json({ error: "Ancien mot de passe incorrect." }, { status: 400 });
    const { error } = await supabase.from("app_users").update({ password_hash: hashPassword(newPassword), updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) throw error;
    // Un mot de passe changé doit couper les sessions ouvertes ailleurs (cookie volé, appareil perdu).
    try {
      await revokeUserSessions(user.id, { keepCurrent: true });
    } catch (revokeError) {
      console.error("[auth/password] Révocation des sessions impossible :", revokeError);
      return Response.json(
        { error: "Mot de passe modifié, mais la déconnexion des autres appareils a échoué. Réessayez plus tard." },
        { status: 500 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de modifier le mot de passe." }, { status: 500 });
  }
}
