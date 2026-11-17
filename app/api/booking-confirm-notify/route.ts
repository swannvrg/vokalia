import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf-8").digest();
}

function isAuthorized(request: Request): boolean {
  const accepted = [
    process.env.CALLBACK_WEBHOOK_SECRET,
    process.env.CALLBACK_WEBHOOK_SECRET_PREVIOUS,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (accepted.length === 0) return false;

  const received = request.headers.get("x-webhook-secret") ?? "";
  if (!received) return false;

  const receivedHash = sha256(received);
  let ok = false;
  for (const expected of accepted) {
    if (timingSafeEqual(receivedHash, sha256(expected))) ok = true;
  }
  return ok;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatParisDateTime(value: string): {
  weekday: string;
  dayMonth: string;
  time: string;
} | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
  }).format(date).toLocaleLowerCase("fr-FR");

  const dayMonth = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
  }).format(date).replaceAll("-", "/");

  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!hour || !minute) return null;

  return { weekday, dayMonth, time: `${hour}h${minute}` };
}

function formatFrenchPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let national = digits;
  if (digits.startsWith("33") && digits.length === 11) {
    national = `0${digits.slice(2)}`;
  }
  if (!/^0\d{9}$/.test(national)) return null;
  return national.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

function formatPrice(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  return trimmed
    ? `${trimmed.charAt(0).toLocaleLowerCase("fr-FR")}${trimmed.slice(1)}`
    : trimmed;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let appointmentId: string | undefined;

  try {
    const body = await request.json();
    if (body.type && body.type !== "INSERT") {
      return Response.json({ ok: true, skipped: "not_insert" });
    }
    if (body.table && body.table !== "appointments") {
      return Response.json({ ok: true, skipped: "wrong_table" });
    }

    appointmentId = body.record?.id ?? body.id;
    if (!appointmentId || typeof appointmentId !== "string") {
      return Response.json({ error: "Missing appointment id" }, { status: 400 });
    }

    const recipient = process.env.BOOKING_NOTIFY_EMAIL?.trim();
    if (!recipient) {
      console.error("[booking-confirm-notify] missing BOOKING_NOTIFY_EMAIL", {
        appointment_id: appointmentId,
      });
      return Response.json({ error: "Missing BOOKING_NOTIFY_EMAIL" }, { status: 500 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_appointment_email_delivery",
      { p_appointment_id: appointmentId },
    );
    if (claimError) throw claimError;
    if (claimed !== true) {
      return Response.json({ ok: true, already_notified: true });
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id,business_id,service_id,resource_id,start_time")
      .eq("id", appointmentId)
      .maybeSingle();
    if (appointmentError) throw appointmentError;
    if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND");

    const [businessResult, serviceResult, practitionerResult] = await Promise.all([
      supabase
        .from("businesses")
        .select("name,address,real_phone_number,phone_number")
        .eq("id", appointment.business_id)
        .maybeSingle(),
      supabase
        .from("services")
        .select("name,price")
        .eq("id", appointment.service_id)
        .maybeSingle(),
      appointment.resource_id
        ? supabase
            .from("resources")
            .select("name")
            .eq("id", appointment.resource_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (businessResult.error) throw businessResult.error;
    if (serviceResult.error) throw serviceResult.error;
    if (practitionerResult.error) throw practitionerResult.error;

    const salonName = businessResult.data?.name?.trim();
    const serviceName = serviceResult.data?.name?.trim();
    const dateTime = formatParisDateTime(appointment.start_time);

    if (!salonName || !serviceName || !dateTime) {
      const missing = [
        !salonName ? "salon_name" : "",
        !serviceName ? "service_name" : "",
        !dateTime ? "start_time" : "",
      ].filter(Boolean).join(",");
      console.error("[booking-confirm-notify] missing mandatory data", {
        appointment_id: appointmentId,
        missing,
      });
      await supabase
        .from("appointment_email_deliveries")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          last_error: `MANDATORY_DATA_MISSING:${missing}`,
        })
        .eq("appointment_id", appointmentId);
      return Response.json({ ok: true, skipped: "missing_mandatory_data" });
    }

    const address = businessResult.data?.address?.trim() || null;
    const rawPhone =
      businessResult.data?.real_phone_number?.trim()
      || businessResult.data?.phone_number?.trim()
      || "";
    const salonPhone = rawPhone ? formatFrenchPhone(rawPhone) : null;
    const practitionerName = practitionerResult.data?.name?.trim() || null;
    const price = formatPrice(serviceResult.data?.price ?? null);
    const serviceForText = lowerFirst(serviceName);
    const practitionerText = practitionerName ? ` avec ${practitionerName}` : "";
    const cancellationText = salonPhone
      ? ` Pour annuler ou déplacer, appelez le ${salonPhone}.`
      : " Pour annuler ou déplacer, contactez le salon.";

    const subject =
      `${salonName} – RDV confirmé le ${dateTime.weekday} ${dateTime.dayMonth} à ${dateTime.time}`;
    const text = [
      `${salonName} : votre RDV ${serviceForText}${practitionerText} est confirmé le ${dateTime.weekday} ${dateTime.dayMonth} à ${dateTime.time}.${cancellationText}`,
      "",
      "Détails du rendez-vous",
      `Prestation : ${serviceName}`,
      practitionerName ? `Praticien : ${practitionerName}` : "",
      `Date : ${dateTime.weekday} ${dateTime.dayMonth}`,
      `Heure : ${dateTime.time}`,
      price ? `Prix : ${price}` : "",
      address ? `Adresse : ${address}` : "",
    ].filter(Boolean).join("\n");

    const detailRows = [
      ["Prestation", serviceName],
      ["Praticien", practitionerName],
      ["Date", `${dateTime.weekday} ${dateTime.dayMonth}`],
      ["Heure", dateTime.time],
      ["Prix", price],
      ["Adresse", address],
    ].filter(([, value]) => Boolean(value));

    const html = `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f6f3ef;font-family:Arial,Helvetica,sans-serif;color:#302923;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px;">
        <h1 style="margin:0 0 16px;font-size:24px;color:#BD5B39;">${escapeHtml(salonName)}</h1>
        <p style="margin:0 0 20px;line-height:1.5;">${escapeHtml(salonName)} : votre RDV ${escapeHtml(serviceForText)}${practitionerText ? ` avec ${escapeHtml(practitionerName ?? "")}` : ""} est confirmé le ${escapeHtml(dateTime.weekday)} ${escapeHtml(dateTime.dayMonth)} à ${escapeHtml(dateTime.time)}.${escapeHtml(cancellationText)}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${detailRows.map(([label, value]) => `
            <tr>
              <td style="padding:9px 10px;border-bottom:1px solid #ece6df;font-weight:bold;width:110px;">${escapeHtml(label ?? "")}</td>
              <td style="padding:9px 10px;border-bottom:1px solid #ece6df;">${escapeHtml(value ?? "")}</td>
            </tr>`).join("")}
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

    try {
      await sendEmail({
        to: recipient,
        subject,
        html,
        text,
        fromName: salonName,
      });
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error
          ? sendError.message.slice(0, 1000)
          : "UNKNOWN_SEND_ERROR";
      await supabase
        .from("appointment_email_deliveries")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          last_error: errorMessage,
        })
        .eq("appointment_id", appointmentId);
      console.error("[booking-confirm-notify] send failed", {
        appointment_id: appointmentId,
      });
      return Response.json({ error: "Notification failed" }, { status: 500 });
    }

    await supabase
      .from("appointment_email_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("appointment_id", appointmentId);

    return Response.json({ ok: true });
  } catch (error) {
    if (appointmentId) {
      try {
        const supabase = createSupabaseAdminClient();
        await supabase
          .from("appointment_email_deliveries")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
            last_error: error instanceof Error
              ? error.message.slice(0, 1000)
              : "UNKNOWN_ERROR",
          })
          .eq("appointment_id", appointmentId);
      } catch {
        // Le rendez-vous reste valide ; l'échec est journalisé côté route.
      }
    }
    console.error("[booking-confirm-notify] unexpected error", {
      appointment_id: appointmentId ?? "unknown",
    });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
