export type BookingMessageInput = {
  customerName: string;
  customerPhone?: string | null;
  salonName: string;
  address?: string | null;
  salonPhone?: string | null;
  serviceName: string;
  durationMinutes?: number | null;
  price?: number | null;
  startTime: string;
  resourceName?: string | null;
  note?: string | null;
  isTest?: boolean;
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

const parisDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return { date: formatter.format(date), time };
};

const price = (value?: number | null) =>
  value == null
    ? ""
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);

const optionalLines = (booking: BookingMessageInput, date: string, time: string) => {
  const details = [
    booking.durationMinutes != null ? `${booking.durationMinutes} min` : "",
    booking.price != null ? price(booking.price) : "",
  ].filter(Boolean);
  return [
    `Prestation : ${booking.serviceName}${details.length ? ` (${details.join(", ")})` : ""}`,
    date && time ? `Quand : ${date} à ${time}` : "",
    booking.resourceName ? `Avec : ${booking.resourceName}` : "",
    booking.address ? `Où : ${booking.salonName}, ${booking.address}` : `Où : ${booking.salonName}`,
    booking.salonPhone ? `Une question ? ${booking.salonPhone}` : "",
    booking.note ? `Note : ${booking.note}` : "",
  ].filter(Boolean);
};

const truncateSms = (value: string) => {
  if (value.length <= 160) return value;
  const truncated = value.slice(0, 157);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 80 ? lastSpace : 157)}...`;
};

export function buildBookingMessage(booking: BookingMessageInput) {
  const { date, time } = parisDateTime(booking.startTime);
  const subject = `Rendez-vous confirmé - ${booking.salonName} le ${date} à ${time}`;
  const header = booking.isTest
    ? `[TEST] Client : ${booking.customerName} · ${booking.customerPhone ?? ""}\n`
    : "";
  const lines = optionalLines(booking, date, time);
  const text = `${header}Bonjour ${booking.customerName},\nVotre rendez-vous est confirmé.\n${lines.join(
    "\n",
  )}\nÀ bientôt !`;
  const html = [
    header ? `<p>${escapeHtml(header.trim())}</p>` : "",
    `<p>Bonjour ${escapeHtml(booking.customerName)},</p>`,
    "<p>Votre rendez-vous est confirmé.</p>",
    `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
    "<p>À bientôt !</p>",
  ].filter(Boolean).join("");
  const sms = truncateSms(`${booking.salonName} : RDV confirmé ${date} à ${time} - ${booking.serviceName}${
    booking.resourceName ? ` avec ${booking.resourceName}` : ""
  }.${booking.salonPhone ? ` Tel ${booking.salonPhone}.` : ""}`);

  return { subject, text, html, sms };
}
