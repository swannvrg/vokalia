import { hashPassword, requireUser, verifyPassword } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 8) return Response.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
    const { data: stored } = await supabase.from("app_users").select("password_hash").eq("id", user.id).single();
    if (!stored?.password_hash || !verifyPassword(currentPassword, stored.password_hash)) return Response.json({ error: "Ancien mot de passe incorrect." }, { status: 400 });
    const { error } = await supabase.from("app_users").update({ password_hash: hashPassword(newPassword), updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de modifier le mot de passe." }, { status: 500 });
  }
}
