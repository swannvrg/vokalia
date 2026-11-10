import { createSession, createSupabaseAdminClient, hashPassword, revokeUserSessions, tokenHash } from "@/lib/supabase";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (!token) return Response.json({ error: "Lien d'invitation invalide." }, { status: 400 });
    // Valider le mot de passe AVANT de consommer le jeton, pour ne pas brûler le lien sur une simple faute de saisie.
    if (!isStrongPassword(password)) return Response.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    // Consommation atomique : un seul UPDATE conditionnel, donc deux requêtes simultanées
    // avec le même lien ne peuvent pas réussir toutes les deux.
    const now = new Date().toISOString();
    const { data: invitation, error: consumeError } = await supabase
      .from("app_invitation_tokens")
      .update({ used_at: now })
      .eq("token_hash", tokenHash(token))
      .is("used_at", null)
      .gt("expires_at", now)
      .select("id, user_id")
      .maybeSingle();
    if (consumeError) throw consumeError;
    if (!invitation) return Response.json({ error: "Ce lien d'invitation est invalide ou expiré." }, { status: 400 });
    const { error: userError } = await supabase.from("app_users").update({ password_hash: hashPassword(password), active: true }).eq("id", invitation.user_id);
    if (userError) throw userError;
    await revokeUserSessions(invitation.user_id, { keepCurrent: false });
    await createSession(invitation.user_id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Impossible de finaliser l'invitation." }, { status: 500 });
  }
}
