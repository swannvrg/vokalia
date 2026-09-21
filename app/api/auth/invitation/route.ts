import { createSession, createSupabaseAdminClient, hashPassword, tokenHash } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (!token || password.length < 8) return Response.json({ error: "Lien ou mot de passe invalide." }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    const { data: invitation } = await supabase.from("app_invitation_tokens").select("id, user_id, expires_at, used_at").eq("token_hash", tokenHash(token)).maybeSingle();
    if (!invitation || invitation.used_at || new Date(invitation.expires_at) <= new Date()) return Response.json({ error: "Ce lien d'invitation est invalide ou expiré." }, { status: 400 });
    const { error: userError } = await supabase.from("app_users").update({ password_hash: hashPassword(password), active: true }).eq("id", invitation.user_id);
    if (userError) throw userError;
    const { error: tokenError } = await supabase.from("app_invitation_tokens").update({ used_at: new Date().toISOString() }).eq("id", invitation.id);
    if (tokenError) throw tokenError;
    await createSession(invitation.user_id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Impossible de finaliser l'invitation." }, { status: 500 });
  }
}