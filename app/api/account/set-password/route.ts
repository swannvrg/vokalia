import { hashPassword, requireUser } from "@/lib/supabase";

const rules = {
  length: (value: string) => value.length >= 8,
  uppercase: (value: string) => /[A-Z]/.test(value),
  number: (value: string) => /\d/.test(value),
  symbol: (value: string) => /[^A-Za-z0-9]/.test(value),
};

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!user.must_change_password) {
      return Response.json({ error: "Ce changement n'est plus requis." }, { status: 400 });
    }
    const body = await request.json();
    const password = String(body.password ?? "");
    if (!Object.values(rules).every((rule) => rule(password))) {
      return Response.json({ error: "Le mot de passe doit contenir 8 caractères, une majuscule, un chiffre et un symbole." }, { status: 400 });
    }
    const { error } = await supabase
      .from("app_users")
      .update({ password_hash: hashPassword(password), must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .eq("must_change_password", true);
    if (error) throw error;
    return Response.json({ ok: true, businessId: user.business_id, onboardingPending: Boolean(user.onboarding_pending) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    console.error("[account/set-password] Échec :", error instanceof Error ? error.message : "erreur inconnue");
    return Response.json({ error: "Impossible d'enregistrer le mot de passe." }, { status: 500 });
  }
}
