import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";

const ADMIN_NOTIFICATION_EMAIL = "swannvrg@gmail.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const salonName = String(body.salonName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim() || null;
    const message = String(body.message ?? "").trim() || null;

    if (!salonName || !email) return Response.json({ error: "Nom du salon et email sont obligatoires." }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("invitation_requests").insert({
      salon_name: salonName,
      contact_name: email,
      email,
      phone,
      message,
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
        <td style="padding:8px 0;font-weight:600;">${escapeHtml(salonName)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Email</td>
        <td style="padding:8px 0;">${escapeHtml(email)}</td>
      </tr>
      ${phone ? `<tr><td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Téléphone</td><td style="padding:8px 0;">${escapeHtml(phone)}</td></tr>` : ""}
      ${message ? `<tr><td style="padding:8px 0;color:#8C8172;font-size:0.85rem;vertical-align:top;">Message</td><td style="padding:8px 0;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>` : ""}
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] ?? c));
}