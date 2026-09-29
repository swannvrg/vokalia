import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Runtime Node obligatoire (nodemailer ne fonctionne pas en Edge)
// ---------------------------------------------------------------------------
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Vérification du secret webhook — comparaison à temps constant
// ---------------------------------------------------------------------------
function isAuthorized(request: Request): boolean {
  const expected = process.env.CALLBACK_WEBHOOK_SECRET;
  if (!expected) return false;

  const received = request.headers.get("x-webhook-secret") ?? "";
  if (received.length === 0) return false;

  try {
    const a = Buffer.from(received, "utf-8");
    const b = Buffer.from(expected, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Échappement HTML minimal (copie locale — même pattern que invitation-request)
// ---------------------------------------------------------------------------
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] ?? c));
}

// ---------------------------------------------------------------------------
// Formater une date en Europe/Paris, lisible sur mobile
// ---------------------------------------------------------------------------
function formatParisDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// POST /api/callback-notify
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestId: string | undefined;

  try {
    // ── 2. Extraction de l'id depuis le payload ────────────────────────
    const body = await request.json();

    // Payload Database Webhook Supabase : { type, table, schema, record }
    // Ou payload simplifié pour test : { id }
    if (body.type && body.type !== "INSERT") {
      return Response.json({ ok: true, skipped: "not_insert" });
    }
    if (body.table && body.table !== "callback_requests") {
      return Response.json({ ok: true, skipped: "wrong_table" });
    }

    requestId = body.record?.id ?? body.id;
    if (!requestId || typeof requestId !== "string") {
      return Response.json({ error: "Missing callback request id" }, { status: 400 });
    }

    // ── 3. Relecture depuis la base (source de vérité) ─────────────────
    const supabase = createSupabaseAdminClient();

    const { data: cbr, error: cbrError } = await supabase
      .from("callback_requests")
      .select("id, business_id, customer_name, callback_number, reason, status, notified_at, created_at")
      .eq("id", requestId)
      .maybeSingle();

    if (cbrError) throw cbrError;
    if (!cbr) {
      return Response.json({ error: "Callback request not found" }, { status: 404 });
    }

    // Idempotence : déjà notifié → on ne renvoie rien
    if (cbr.notified_at) {
      console.log(`[callback-notify] ${cbr.id} already notified, skipping`);
      return Response.json({ ok: true, already_notified: true });
    }

    // ── 4. Récupération du salon ──────────────────────────────────────
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, notify_channel, notify_email")
      .eq("id", cbr.business_id)
      .maybeSingle();

    if (bizError) throw bizError;
    if (!business) {
      await supabase.from("callback_requests").update({ notify_error: "BUSINESS_NOT_FOUND" }).eq("id", cbr.id);
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    // ── 5. Détermination du canal ─────────────────────────────────────
    let channel = business.notify_channel ?? "email";
    if (channel === "sms") {
      console.log(`[callback-notify] ${cbr.id} — canal sms pas encore implémenté, fallback email`);
      channel = "email";
    }

    const recipient = business.notify_email;
    if (!recipient) {
      await supabase.from("callback_requests").update({ notify_error: "NO_RECIPIENT" }).eq("id", cbr.id);
      console.log(`[callback-notify] ${cbr.id} — NO_RECIPIENT`);
      return Response.json({ error: "No recipient configured" }, { status: 500 });
    }

    // ── 6. Construction et envoi de l'email ───────────────────────────
    const safeName = escapeHtml(cbr.customer_name ?? "Client inconnu");
    const safeReason = escapeHtml(cbr.reason ?? "Non précisée");
    const safeNumber = escapeHtml(cbr.callback_number ?? "—");
    const safeSalonName = escapeHtml(business.name ?? "Salon");
    const callTime = formatParisDate(cbr.created_at);

    const subject = `Demande de rappel : ${cbr.customer_name ?? "Client inconnu"}`;

    const html = `
<div style="font-family:'Hanken Grotesk',sans-serif;background:#15120F;color:#F2ECE1;max-width:560px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid #332C24;">
  <div style="padding:24px 28px;border-bottom:1px solid #332C24;">
    <p style="margin:0 0 4px;font-size:0.78rem;color:#E0A583;font-weight:500;letter-spacing:0.01em;">Vokalia · ${safeSalonName}</p>
    <h2 style="margin:0;font-size:1.3rem;font-weight:600;">Demande de rappel</h2>
  </div>
  <div style="padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;width:140px;">Nom</td>
        <td style="padding:8px 0;font-weight:600;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Numéro à rappeler</td>
        <td style="padding:8px 0;font-weight:600;">${safeNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Raison</td>
        <td style="padding:8px 0;white-space:pre-wrap;">${safeReason}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#8C8172;font-size:0.85rem;">Heure de l'appel</td>
        <td style="padding:8px 0;">${escapeHtml(callTime)}</td>
      </tr>
    </table>
  </div>
</div>
`.trim();

    const text = `Demande de rappel — ${safeSalonName}\n\nNom : ${cbr.customer_name ?? "Client inconnu"}\nNuméro : ${cbr.callback_number ?? "—"}\nRaison : ${cbr.reason ?? "Non précisée"}\nHeure de l'appel : ${callTime}`;

    try {
      await sendEmail({ to: recipient, subject, html, text });
    } catch (sendError) {
      const errMsg = sendError instanceof Error ? sendError.message.slice(0, 200) : "UNKNOWN_SEND_ERROR";
      await supabase.from("callback_requests").update({ notify_error: errMsg }).eq("id", cbr.id);
      console.error(`[callback-notify] ${cbr.id} — send failed`);
      return Response.json({ error: "Notification failed" }, { status: 500 });
    }

    // ── 7. Succès : mise à jour de la ligne ───────────────────────────
    await supabase
      .from("callback_requests")
      .update({ notified_at: new Date().toISOString(), notify_error: null })
      .eq("id", cbr.id);

    console.log(`[callback-notify] ${cbr.id} — notified`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[callback-notify] ${requestId ?? "unknown"} — unexpected error`);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
