import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import {
  containsLinkOrDomain,
  escapeInvitationNonLinkHtml,
  invitationValidation,
  isInvitationRateLimited,
  isDisposableEmail,
  isValidInvitationEmail,
} from "@/lib/invitation-security";
import { verifyTurnstileToken } from "@/lib/turnstile";

const ADMIN_NOTIFICATION_EMAIL = "swannvrg@gmail.com";
const RATE_LIMIT_MESSAGE = "Trop de demandes. Veuillez réessayer plus tard.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (String(body.website ?? "").trim()) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const salonName = String(body.salonName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim() || null;
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null;
    const message = String(body.message ?? "").trim() || null;

    if (!salonName || !email) {
      return Response.json(
        { error: "Nom du salon et email sont obligatoires." },
        { status: 400 },
      );
    }
    if (salonName.length > invitationValidation.maxSalonNameLength) {
      return Response.json({ error: "Le nom du salon est trop long." }, { status: 400 });
    }
    if (
      email.length > invitationValidation.maxEmailLength ||
      !isValidInvitationEmail(email)
    ) {
      return Response.json({ error: "L'adresse email n'est pas valide." }, { status: 400 });
    }
    if (message && message.length > invitationValidation.maxMessageLength) {
      return Response.json({ error: "Le message est trop long." }, { status: 400 });
    }
    if (message && containsLinkOrDomain(message)) {
      return Response.json(
        { error: "Les liens ne sont pas acceptés dans ce message." },
        { status: 400 },
      );
    }
    if (isDisposableEmail(email)) {
      return Response.json(
        { error: "Les adresses email temporaires ne sont pas acceptées." },
        { status: 400 },
      );
    }
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      if (
        phoneDigits.length < invitationValidation.minPhoneDigits ||
        phoneDigits.length > invitationValidation.maxPhoneDigits
      ) {
        return Response.json(
          { error: "Le numéro de téléphone doit contenir entre 9 et 15 chiffres." },
          { status: 400 },
        );
      }
    }

    if (!(await verifyTurnstileToken(String(body.turnstileToken ?? ""), getRequestIp(request)))) {
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY) {
        return Response.json(
          { error: "La vérification anti-robot a échoué. Réessayez." },
          { status: 400 },
        );
      }
    }

    const supabase = createSupabaseAdminClient();
    const requestIp = getRequestIp(request);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ count: ipCount, error: ipCountError }, { count: emailCount, error: emailCountError }, { count: phoneCount, error: phoneCountError }] =
      await Promise.all([
        supabase
          .from("invitation_requests")
          .select("id", { count: "exact", head: true })
          .eq("request_ip", requestIp)
          .gte("created_at", oneHourAgo),
        supabase
          .from("invitation_requests")
          .select("id", { count: "exact", head: true })
          .eq("email", email)
          .gte("created_at", oneDayAgo),
        phone
          ? supabase
              .from("invitation_requests")
              .select("id", { count: "exact", head: true })
              .eq("phone", normalizedPhone)
              .gte("created_at", oneDayAgo)
          : Promise.resolve({ count: 0, error: null }),
      ]);
    if (ipCountError) throw ipCountError;
    if (emailCountError) throw emailCountError;
    if (phoneCountError) throw phoneCountError;
    if (
      isInvitationRateLimited({
        ip: ipCount ?? 0,
        email: emailCount ?? 0,
        phone: phoneCount ?? 0,
      })
    ) {
      return Response.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    }

    const { error } = await supabase.from("invitation_requests").insert({
      salon_name: salonName,
      contact_name: email,
      email,
      phone: normalizedPhone,
      message,
      request_ip: requestIp,
      status: "pending",
    });
    if (error) throw error;

    // Notification admin — l'échec d'envoi ne doit jamais bloquer la réponse au demandeur.
    try {
      const adminUrl = `${new URL(request.url).origin}/admin`;
      const html = `
<div style="font-family:'Hanken Grotesk',sans-serif;background:#15120F;color:#F2ECE1;max-width:560px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid #332C24;">
  <div style="padding:24px 28px;border-bottom:1px solid #332C24;">
    <p style="margin:0 0 4px;font-size:0.78rem;color:#E0A583;font-weight:500;letter-spacing:0.01em;">Vokalia · Administration</p>
    <h2 style="margin:0;font-size:1.3rem;font-weight:600;">Nouvelle demande d&rsquo;invitation</h2>
  </div>
  <div style="padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;width:140px;">Salon</td>
        <td style="padding:8px 0;font-weight:600;">${escapeInvitationNonLinkHtml(salonName)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Email</td>
        <td style="padding:8px 0;">${escapeInvitationNonLinkHtml(email)}</td>
      </tr>
      ${phone ? `<tr><td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Téléphone</td><td style="padding:8px 0;">${escapeInvitationNonLinkHtml(phone)}</td></tr>` : ""}
      ${message ? `<tr><td style="padding:8px 0;color:#8C8172;font-size:0.85rem;vertical-align:top;">Message</td><td style="padding:8px 0;white-space:pre-wrap;">${escapeInvitationNonLinkHtml(message)}</td></tr>` : ""}
    </table>
    <div style="margin-top:28px;">
      <a href="${adminUrl}" style="display:inline-block;padding:10px 22px;background:#BD5B39;color:#F2ECE1;text-decoration:none;border-radius:10px;font-weight:600;font-size:0.95rem;">
        Traiter la demande dans /admin
      </a>
    </div>
  </div>
</div>
`.trim();

      await sendEmail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `Nouvelle demande d'invitation Vokalia — ${salonName}`,
        html,
      });
    } catch (notifError) {
      // On logue mais on ne fait pas échouer la réponse utilisateur.
      console.error("[invitation-request] Échec envoi notification admin :", notifError instanceof Error ? notifError.message : notifError);
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Impossible d'enregistrer votre demande." }, { status: 500 });
  }
}

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
