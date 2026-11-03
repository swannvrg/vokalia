import { generateTemporaryPassword, hashPassword, requireAdmin } from "@/lib/supabase";
import { sendTemporaryPasswordEmail } from "@/lib/email";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let supabase;
  let businessId: string | null = null;
  let userId: string | null = null;
  try {
    ({ supabase } = await requireAdmin());
    const body = await request.json();
    const salonName = String(body.salonName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    if (!salonName || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: "Indiquez un nom de salon et une adresse email valide." }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("app_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return Response.json({ error: "Cette adresse email possède déjà un compte Vokalia." }, { status: 409 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const businessValues: Record<string, unknown> = {
      name: salonName,
      business_type: "salon",
      real_phone_number: phone || "",
      twilio_number: "",
      status: "active",
      listed: false,
    };
    let { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert(businessValues)
      .select("id")
      .single();
    if (businessError && /listed|column/i.test(businessError.message ?? "")) {
      const withoutListed = { ...businessValues };
      delete withoutListed.listed;
      ({ data: business, error: businessError } = await supabase
        .from("businesses")
        .insert(withoutListed)
        .select("id")
        .single());
    }
    if (businessError || !business) throw businessError || new Error("BUSINESS_CREATE_FAILED");
    const createdBusiness = business;
    businessId = createdBusiness.id;

    const { data: user, error: userError } = await supabase
      .from("app_users")
      .insert({
        email,
        password_hash: hashPassword(temporaryPassword),
        role: "owner",
        active: true,
        business_id: businessId,
        must_change_password: true,
        onboarding_pending: true,
      })
      .select("id")
      .single();
    if (userError) throw userError;
    userId = user.id;

    const { error: linkError } = await supabase
      .from("businesses")
      .update({ app_user_id: userId })
      .eq("id", businessId);
    if (linkError) throw linkError;

    let emailSent = true;
    try {
      await sendTemporaryPasswordEmail({
        to: email,
        salonName,
        loginEmail: email,
        temporaryPassword,
      });
    } catch (error) {
      emailSent = false;
      console.error("[admin/invite-salon] Email non envoyé :", error instanceof Error ? error.message : "erreur inconnue");
    }

    return Response.json({
      ok: true,
      emailSent,
      temporaryPassword,
      warning: emailSent ? undefined : "Email non envoyé, transmettez le mot de passe manuellement.",
    });
  } catch (error) {
    if (userId) await supabase?.from("app_users").delete().eq("id", userId);
    if (businessId) await supabase?.from("businesses").delete().eq("id", businessId);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
    }
    console.error("[admin/invite-salon] Échec de l'invitation :", error instanceof Error ? error.message : "erreur inconnue");
    return Response.json({ error: "Impossible de créer l'invitation." }, { status: 500 });
  }
}
