import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Transporter SMTP — toute la config vient des variables d'environnement.
// Aucune valeur en dur. STARTTLS sur le port 587 (secure: false).
// ---------------------------------------------------------------------------
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.PASSWORD_MAIL_VOKALIA;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP_CONFIG_MISSING: vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER et PASSWORD_MAIL_VOKALIA dans .env.local");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS — le serveur Infomaniak sur le port 587 upgradera la connexion
    auth: { user, pass },
  });
}

// ---------------------------------------------------------------------------
// Échappement HTML minimal (inchangé par rapport à l'ancienne version)
// ---------------------------------------------------------------------------
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

// ---------------------------------------------------------------------------
// Envoi générique — destinataire, sujet, corps HTML (+ fallback texte brut)
// ---------------------------------------------------------------------------
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const transporter = createTransporter();
  const from = `Vokalia <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({ from, to, subject, html, text: text ?? html.replace(/<[^>]+>/g, " ") });
  } catch (error) {
    // On logue sans ré-exposer de donnée sensible (le mot de passe est dans l'env, pas dans le message)
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SMTP_SEND_ERROR: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Invitation salon — même contenu qu'avant, via le nouvel expéditeur
// ---------------------------------------------------------------------------
export async function sendSalonInvitationEmail({
  to,
  contactName,
  salonName,
  invitationUrl,
}: {
  to: string;
  contactName: string;
  salonName: string;
  invitationUrl: string;
}) {
  const safeContactName = escapeHtml(contactName);
  const safeSalonName = escapeHtml(salonName);
  const safeInvitationUrl = escapeHtml(invitationUrl);

  const html = `
<p>Bonjour ${safeContactName},</p>
<p>Votre espace pour <strong>${safeSalonName}</strong> vient d'être créé sur Vokalia.</p>
<p>
  <a href="${safeInvitationUrl}" style="display:inline-block;padding:10px 20px;background:#BD5B39;color:#F2ECE1;text-decoration:none;border-radius:10px;font-weight:600;">
    Définir mon mot de passe et accéder à mon espace
  </a>
</p>
<p>Ce lien vous permettra de terminer votre inscription. Il est à usage unique.</p>
<p style="color:#8C8172;font-size:0.9em;">Si vous n'avez pas demandé à rejoindre Vokalia, vous pouvez ignorer cet email.</p>
`.trim();

  await sendEmail({ to, subject: "Votre espace Vokalia est prêt", html });
}
